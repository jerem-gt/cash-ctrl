import supertest from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_TX = {
  account_id: null as number | null,
  new_account_qif_name: null as string | null,
  type: 'expense' as const,
  amount: 150,
  description: 'Supermarché',
  subcategory_id: SEED.SUBCAT_SUPERMARCHE,
  new_subcategory_key: null,
  date: '2024-01-15',
  notes: null,
  validated: false,
};

const VALID_TRANSFER = {
  from_account_id: null as number | null,
  from_account_qif_name: null as string | null,
  to_account_id: null as number | null,
  to_account_qif_name: null as string | null,
  amount: 500,
  description: 'Virement',
  date: '2024-01-15',
  notes: null,
  validated: false,
};

const EMPTY_BODY = { newAccounts: [], newSubcategories: [], transactions: [], transfers: [] };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/import/qif', () => {
  let ctx: TestContext;
  let accountId: number;
  let account2Id: number;

  beforeEach(async () => {
    ctx = await createTestContext();

    const r1 = await ctx.agent.post('/api/accounts').send({
      name: 'Courant',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      initial_balance: 0,
      opening_date: '2020-01-01',
    });
    accountId = r1.body.id;

    const r2 = await ctx.agent.post('/api/accounts').send({
      name: 'Épargne',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_EPARGNE,
      initial_balance: 0,
      opening_date: '2021-01-01',
    });
    account2Id = r2.body.id;
  });

  // ─── Auth ──────────────────────────────────────────────────────────────────

  it('retourne 401 sans authentification', async () => {
    const res = await supertest(ctx.app).post('/api/import/qif').send(EMPTY_BODY);
    expect(res.status).toBe(401);
  });

  // ─── Validation Zod ────────────────────────────────────────────────────────

  it('retourne 400 si le body est vide', async () => {
    const res = await ctx.agent.post('/api/import/qif').send({});
    expect(res.status).toBe(400);
  });

  it('retourne 400 si transactions manque account_id ET new_account_qif_name', async () => {
    const tx = { ...VALID_TX, account_id: null, new_account_qif_name: null };
    const res = await ctx.agent.post('/api/import/qif').send({ ...EMPTY_BODY, transactions: [tx] });
    expect(res.status).toBe(400);
  });

  it('retourne 400 si transaction a un montant négatif', async () => {
    const tx = { ...VALID_TX, account_id: accountId, amount: -50 };
    const res = await ctx.agent.post('/api/import/qif').send({ ...EMPTY_BODY, transactions: [tx] });
    expect(res.status).toBe(400);
  });

  it('retourne 400 si transaction a une date mal formatée', async () => {
    const tx = { ...VALID_TX, account_id: accountId, date: '15/01/2024' };
    const res = await ctx.agent.post('/api/import/qif').send({ ...EMPTY_BODY, transactions: [tx] });
    expect(res.status).toBe(400);
  });

  it('retourne 400 si transfer manque from_account_id ET from_account_qif_name', async () => {
    const tf = {
      ...VALID_TRANSFER,
      from_account_id: null,
      from_account_qif_name: null,
      to_account_id: account2Id,
    };
    const res = await ctx.agent.post('/api/import/qif').send({ ...EMPTY_BODY, transfers: [tf] });
    expect(res.status).toBe(400);
  });

  it('retourne 400 si transfer manque to_account_id ET to_account_qif_name', async () => {
    const tf = {
      ...VALID_TRANSFER,
      from_account_id: accountId,
      to_account_id: null,
      to_account_qif_name: null,
    };
    const res = await ctx.agent.post('/api/import/qif').send({ ...EMPTY_BODY, transfers: [tf] });
    expect(res.status).toBe(400);
  });

  it('retourne 400 si newSubcategory manque category_id ET new_category_name', async () => {
    const ns = { qif_key: 'Food:Out', subcategory_name: 'Restaurant' };
    const res = await ctx.agent
      .post('/api/import/qif')
      .send({ ...EMPTY_BODY, newSubcategories: [ns] });
    expect(res.status).toBe(400);
  });

  it('retourne 400 si newAccount a une date mal formatée', async () => {
    const na = {
      qif_name: 'NewAcc',
      name: 'Nouveau',
      account_type_id: SEED.AT_COURANT,
      initial_balance: 0,
      opening_date: 'not-a-date',
    };
    const res = await ctx.agent.post('/api/import/qif').send({ ...EMPTY_BODY, newAccounts: [na] });
    expect(res.status).toBe(400);
  });

  // ─── Import de transactions ────────────────────────────────────────────────

  it('importe une transaction de dépense sur un compte existant', async () => {
    const tx = { ...VALID_TX, account_id: accountId };
    const res = await ctx.agent.post('/api/import/qif').send({ ...EMPTY_BODY, transactions: [tx] });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ transactions: 1, transfers: 0 });
  });

  it('importe une transaction de revenu', async () => {
    const tx = {
      ...VALID_TX,
      account_id: accountId,
      type: 'income' as const,
      subcategory_id: SEED.SUBCAT_SALAIRE,
    };
    const res = await ctx.agent.post('/api/import/qif').send({ ...EMPTY_BODY, transactions: [tx] });
    expect(res.status).toBe(201);
    expect(res.body.transactions).toBe(1);
  });

  it('persiste la transaction dans la DB', async () => {
    const tx = { ...VALID_TX, account_id: accountId, validated: true, notes: 'note test' };
    await ctx.agent.post('/api/import/qif').send({ ...EMPTY_BODY, transactions: [tx] });

    const row = ctx.db.prepare('SELECT * FROM transactions WHERE account_id = ?').get(accountId) as
      | { amount: number; validated: number; notes: string }
      | undefined;
    expect(row?.amount).toBe(150);
    expect(row?.validated).toBe(1);
    expect(row?.notes).toBe('note test');
  });

  it('importe plusieurs transactions', async () => {
    const txs = [
      { ...VALID_TX, account_id: accountId },
      { ...VALID_TX, account_id: accountId, type: 'income' as const, amount: 2000 },
    ];
    const res = await ctx.agent.post('/api/import/qif').send({ ...EMPTY_BODY, transactions: txs });
    expect(res.status).toBe(201);
    expect(res.body.transactions).toBe(2);
  });

  // ─── Import de virements ───────────────────────────────────────────────────

  it('importe un virement entre comptes existants', async () => {
    const tf = {
      ...VALID_TRANSFER,
      from_account_id: accountId,
      to_account_id: account2Id,
    };
    const res = await ctx.agent.post('/api/import/qif').send({ ...EMPTY_BODY, transfers: [tf] });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ transactions: 0, transfers: 1 });
  });

  it('lie les deux côtés du virement par transfer_peer_id', async () => {
    const tf = {
      ...VALID_TRANSFER,
      from_account_id: accountId,
      to_account_id: account2Id,
    };
    await ctx.agent.post('/api/import/qif').send({ ...EMPTY_BODY, transfers: [tf] });

    const txs = ctx.db
      .prepare('SELECT id, transfer_peer_id FROM transactions ORDER BY id')
      .all() as Array<{ id: number; transfer_peer_id: number | null }>;
    expect(txs).toHaveLength(2);
    expect(txs[0].transfer_peer_id).toBe(txs[1].id);
    expect(txs[1].transfer_peer_id).toBe(txs[0].id);
  });

  it('crée les transactions de virement avec le bon type', async () => {
    const tf = {
      ...VALID_TRANSFER,
      from_account_id: accountId,
      to_account_id: account2Id,
    };
    await ctx.agent.post('/api/import/qif').send({ ...EMPTY_BODY, transfers: [tf] });

    const expense = ctx.db
      .prepare('SELECT type FROM transactions WHERE account_id = ?')
      .get(accountId) as { type: string } | undefined;
    const income = ctx.db
      .prepare('SELECT type FROM transactions WHERE account_id = ?')
      .get(account2Id) as { type: string } | undefined;
    expect(expense?.type).toBe('expense');
    expect(income?.type).toBe('income');
  });

  // ─── Création de nouveaux comptes ─────────────────────────────────────────

  it('crée un nouveau compte via newAccounts et y rattache la transaction', async () => {
    const newAccount = {
      qif_name: 'NewChecking',
      name: 'Nouveau Courant',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      initial_balance: 0,
      opening_date: '2024-01-01',
    };
    const tx = { ...VALID_TX, account_id: null, new_account_qif_name: 'NewChecking' };
    const res = await ctx.agent.post('/api/import/qif').send({
      ...EMPTY_BODY,
      newAccounts: [newAccount],
      transactions: [tx],
    });
    expect(res.status).toBe(201);
    expect(res.body.transactions).toBe(1);

    const acc = ctx.db.prepare("SELECT id FROM accounts WHERE name = 'Nouveau Courant'").get() as
      | { id: number }
      | undefined;
    expect(acc).toBeDefined();

    const row = ctx.db
      .prepare('SELECT account_id FROM transactions WHERE description = ?')
      .get('Supermarché') as { account_id: number } | undefined;
    expect(row?.account_id).toBe(acc?.id);
  });

  it('crée un nouveau compte avec un solde initial', async () => {
    const newAccount = {
      qif_name: 'Savings',
      name: 'Épargne import',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_EPARGNE,
      initial_balance: 1000,
      opening_date: '2022-06-01',
    };
    await ctx.agent.post('/api/import/qif').send({
      ...EMPTY_BODY,
      newAccounts: [newAccount],
    });

    const acc = ctx.db
      .prepare("SELECT initial_balance FROM accounts WHERE name = 'Épargne import'")
      .get() as { initial_balance: number } | undefined;
    expect(acc?.initial_balance).toBe(1000);
  });

  it('résout un virement dont les deux comptes sont nouveaux', async () => {
    const newAccounts = [
      {
        qif_name: 'QifFrom',
        name: 'From Account',
        bank_id: SEED.BANK_ID,
        account_type_id: SEED.AT_COURANT,
        initial_balance: 0,
        opening_date: '2024-01-01',
      },
      {
        qif_name: 'QifTo',
        name: 'To Account',
        bank_id: SEED.BANK_ID,
        account_type_id: SEED.AT_EPARGNE,
        initial_balance: 0,
        opening_date: '2024-01-01',
      },
    ];
    const tf = {
      ...VALID_TRANSFER,
      from_account_id: null,
      from_account_qif_name: 'QifFrom',
      to_account_id: null,
      to_account_qif_name: 'QifTo',
    };
    const res = await ctx.agent.post('/api/import/qif').send({
      ...EMPTY_BODY,
      newAccounts,
      transfers: [tf],
    });
    expect(res.status).toBe(201);
    expect(res.body.transfers).toBe(1);
  });

  // ─── Création de nouvelles sous-catégories ────────────────────────────────

  it('crée une nouvelle sous-catégorie dans une catégorie existante', async () => {
    const ns = {
      qif_key: 'Food:Out',
      category_id: 3,
      subcategory_name: 'Restaurant',
    };
    const tx = {
      ...VALID_TX,
      account_id: accountId,
      subcategory_id: null,
      new_subcategory_key: 'Food:Out',
    };
    const res = await ctx.agent.post('/api/import/qif').send({
      ...EMPTY_BODY,
      newSubcategories: [ns],
      transactions: [tx],
    });
    expect(res.status).toBe(201);

    const sc = ctx.db.prepare("SELECT id FROM subcategories WHERE name = 'Restaurant'").get() as
      | { id: number }
      | undefined;
    expect(sc).toBeDefined();

    const row = ctx.db
      .prepare('SELECT subcategory_id FROM transactions WHERE description = ?')
      .get('Supermarché') as { subcategory_id: number } | undefined;
    expect(row?.subcategory_id).toBe(sc?.id);
  });

  it('crée une nouvelle catégorie et sous-catégorie depuis new_category_name', async () => {
    const ns = {
      qif_key: 'Pets:Food',
      new_category_name: 'Animaux',
      new_category_icon: '🐾',
      subcategory_name: 'Nourriture animaux',
    };
    const tx = {
      ...VALID_TX,
      account_id: accountId,
      subcategory_id: null,
      new_subcategory_key: 'Pets:Food',
    };
    const res = await ctx.agent.post('/api/import/qif').send({
      ...EMPTY_BODY,
      newSubcategories: [ns],
      transactions: [tx],
    });
    expect(res.status).toBe(201);

    const cat = ctx.db.prepare("SELECT id FROM categories WHERE name = 'Animaux'").get() as
      | { id: number }
      | undefined;
    expect(cat).toBeDefined();

    const sc = ctx.db
      .prepare("SELECT category_id FROM subcategories WHERE name = 'Nourriture animaux'")
      .get() as { category_id: number } | undefined;
    expect(sc?.category_id).toBe(cat?.id);
  });

  // ─── Cas mixte ────────────────────────────────────────────────────────────

  it('importe transactions et virements en une seule requête', async () => {
    const tx = { ...VALID_TX, account_id: accountId };
    const tf = {
      ...VALID_TRANSFER,
      from_account_id: accountId,
      to_account_id: account2Id,
    };
    const res = await ctx.agent.post('/api/import/qif').send({
      ...EMPTY_BODY,
      transactions: [tx],
      transfers: [tf],
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ transactions: 1, transfers: 1 });
  });

  it('body vide retourne 201 avec zéros', async () => {
    const res = await ctx.agent.post('/api/import/qif').send(EMPTY_BODY);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ transactions: 0, transfers: 0 });
  });
});
