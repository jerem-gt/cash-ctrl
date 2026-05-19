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

  it('retourne 400 avec le message brut si le body est un tableau (issue.path vide)', async () => {
    const res = await ctx.agent.post('/api/import/qif').send([1, 2, 3]);
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
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
    expect(row?.amount).toBe(15000); // stored in cents (150 € × 100)
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

    const accountsRes = await ctx.agent.get('/api/accounts');
    const acc = (accountsRes.body as { name: string; initial_balance: number }[]).find(
      (a) => a.name === 'Épargne import',
    );
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

// ─── POST /api/import/json-full ───────────────────────────────────────────────

type JsonExportTx = {
  id: number;
  account_id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  subcategory_id: number | null;
  payment_method_id: number | null;
  date: string;
  validated: number;
  notes: string | null;
  transfer_peer_id: number | null;
  reimbursement_status: 'en_attente' | 'rembourse' | null;
  scheduled_id: number | null;
  splits: Array<{ subcategory_id: number; amount: number }>;
};

const EMPTY_EXPORT = {
  version: '1.0' as const,
  amounts_in_cents: true as const,
  account_types: [] as Array<{ id: number; name: string; is_investment: number; is_loan: number }>,
  banks: [] as Array<{ id: number; name: string; logo: string | null; domain: string | null }>,
  accounts: [] as Array<{
    id: number;
    name: string;
    bank_id: number | null;
    account_type_id: number;
    initial_balance: number;
    opening_date: string | null;
    closed_at: string | null;
  }>,
  categories: [] as Array<{
    id: number;
    name: string;
    icon: string;
    subcategories: Array<{ id: number; name: string }>;
  }>,
  payment_methods: [] as Array<{ id: number; name: string; icon: string }>,
  transactions: [] as JsonExportTx[],
  scheduled_transactions: [] as Array<{
    id: number;
    account_id: number;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    subcategory_id: number | null;
    payment_method_id: number | null;
    notes: string | null;
    recurrence_unit: string;
    recurrence_interval: number;
    recurrence_day: number | null;
    recurrence_month: number | null;
    to_account_id: number | null;
    weekend_handling: string;
    start_date: string;
    end_date: string | null;
    active: number;
  }>,
  stock_positions: [] as Array<{
    account_id: number;
    ticker: string;
    quantity: number;
    avg_price: number;
  }>,
  stock_operations: [] as Array<{
    id: number;
    account_id: number;
    transaction_id: number;
    fees_transaction_id: number | null;
    ticker: string;
    type: 'buy' | 'sell';
    quantity: number;
    price_per_share: number;
    fees: number;
    date: string;
  }>,
  loans: [] as Array<{
    id: number;
    account_id: number;
    principal_amount: number;
    interest_rate: number;
    duration_months: number;
    start_date: string;
    monthly_payment: number;
    source_account_id: number;
    deposit_account_id: number;
    deposit_transaction_id: number | null;
    installments: Array<{
      installment_number: number;
      due_date: string;
      total_amount: number;
      principal_amount: number;
      interest_amount: number;
      transaction_id: number | null;
    }>;
  }>,
};

// Export-side IDs (high numbers, distinct from DB auto-increment IDs)
const EX_AT1 = 10,
  EX_AT2 = 11;
const EX_BANK1 = 10,
  EX_BANK2 = 11;
const EX_ACC1 = 20,
  EX_ACC2 = 21,
  EX_ACC3 = 22;
const EX_CAT1 = 10,
  EX_CAT2 = 11;
const EX_SC1 = 30,
  EX_SC2 = 31,
  EX_SC3 = 32;
const EX_PM1 = 10,
  EX_PM2 = 11;
const EX_TX1 = 100,
  EX_TX2 = 101,
  EX_TX3 = 102;
const EX_INS_SUPPORT1 = 50,
  EX_INS_SUPPORT2 = 51;
const EX_INS_OP1 = 60,
  EX_INS_OP2 = 61;

const defaultBankExport = { id: EX_BANK1, name: 'DefaultBank', logo: null, domain: null };
const courantAtExport = { id: EX_AT1, name: 'Courant', is_investment: 0, is_loan: 0 };

const makeExportAccount = (id: number, name: string, bankId = EX_BANK1, atId = EX_AT1) => ({
  id,
  name,
  bank_id: bankId,
  account_type_id: atId,
  initial_balance: 0,
  opening_date: null,
  closed_at: null,
});

const makeExportTx = (
  id: number,
  accountId: number,
  overrides: Partial<JsonExportTx> = {},
): JsonExportTx => ({
  id,
  account_id: accountId,
  type: 'expense',
  amount: 5000,
  description: 'Test',
  subcategory_id: null,
  payment_method_id: null,
  date: '2024-01-15',
  validated: 0,
  notes: null,
  transfer_peer_id: null,
  reimbursement_status: null,
  scheduled_id: null,
  splits: [],
  ...overrides,
});

describe('POST /api/import/json-full', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  // ─── Auth ──────────────────────────────────────────────────────────────────

  it('retourne 401 sans authentification', async () => {
    const res = await supertest(ctx.app).post('/api/import/json-full').send(EMPTY_EXPORT);
    expect(res.status).toBe(401);
  });

  // ─── Validation Zod ────────────────────────────────────────────────────────

  it('retourne 400 si la version est incorrecte', async () => {
    const res = await ctx.agent
      .post('/api/import/json-full')
      .send({ ...EMPTY_EXPORT, version: '2.0' });
    expect(res.status).toBe(400);
  });

  // ─── Export vide ───────────────────────────────────────────────────────────

  it('retourne 201 avec zéros pour un export vide', async () => {
    const res = await ctx.agent.post('/api/import/json-full').send(EMPTY_EXPORT);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      accounts: 0,
      transactions: 0,
      transfers: 0,
      scheduled: 0,
      stockOperations: 0,
      loans: 0,
      insuranceSupports: 0,
      insuranceOperations: 0,
    });
  });

  // ─── buildAccountTypeMap ──────────────────────────────────────────────────

  it('réutilise un type de compte existant et crée un nouveau', async () => {
    const body = {
      ...EMPTY_EXPORT,
      account_types: [
        courantAtExport,
        { id: EX_AT2, name: 'Type Nouveau', is_investment: 0, is_loan: 0 },
      ],
      banks: [defaultBankExport],
      accounts: [
        makeExportAccount(EX_ACC1, 'Compte AT A'),
        makeExportAccount(EX_ACC2, 'Compte AT B', EX_BANK1, EX_AT2),
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    expect(res.body.accounts).toBe(2);
    const newType = ctx.db
      .prepare("SELECT id FROM account_types WHERE name = 'Type Nouveau'")
      .get();
    expect(newType).toBeDefined();
  });

  // ─── buildBankMap ─────────────────────────────────────────────────────────

  it('réutilise une banque existante et crée une nouvelle', async () => {
    const body = {
      ...EMPTY_EXPORT,
      account_types: [courantAtExport],
      banks: [
        defaultBankExport,
        { id: EX_BANK2, name: 'Banque Nouvelle', logo: null, domain: null },
      ],
      accounts: [
        makeExportAccount(EX_ACC1, 'Compte Banque A'),
        makeExportAccount(EX_ACC2, 'Compte Banque B', EX_BANK2),
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    const newBank = ctx.db.prepare("SELECT id FROM banks WHERE name = 'Banque Nouvelle'").get();
    expect(newBank).toBeDefined();
  });

  // ─── buildAccountMap ──────────────────────────────────────────────────────

  it('réutilise un compte existant (par nom) et crée les nouveaux', async () => {
    await ctx.agent.post('/api/accounts').send({
      name: 'Compte Existant',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      initial_balance: 0,
      opening_date: '2020-01-01',
    });
    const body = {
      ...EMPTY_EXPORT,
      account_types: [courantAtExport],
      banks: [defaultBankExport],
      accounts: [
        makeExportAccount(EX_ACC1, 'Compte Existant'), // Found by name → not counted
        makeExportAccount(EX_ACC2, 'Compte Nouveau Import'), // Created
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    expect(res.body.accounts).toBe(1);
  });

  // ─── buildSubcategoryMap ──────────────────────────────────────────────────

  it('réutilise catégorie/sous-catégorie existante et en crée de nouvelles', async () => {
    const body = {
      ...EMPTY_EXPORT,
      categories: [
        {
          id: EX_CAT1,
          name: 'Alimentation',
          icon: '🍴',
          subcategories: [
            { id: EX_SC1, name: 'Supermarché' }, // existing
            { id: EX_SC2, name: 'Restaurant' }, // new
          ],
        },
        {
          id: EX_CAT2,
          name: 'Catégorie Nouvelle',
          icon: '📁',
          subcategories: [{ id: EX_SC3, name: 'Sous-cat Nouvelle' }],
        },
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    expect(
      ctx.db.prepare("SELECT id FROM categories WHERE name = 'Catégorie Nouvelle'").get(),
    ).toBeDefined();
    expect(
      ctx.db.prepare("SELECT id FROM subcategories WHERE name = 'Restaurant'").get(),
    ).toBeDefined();
  });

  // ─── buildPaymentMethodMap ────────────────────────────────────────────────

  it('réutilise un moyen de paiement existant et en crée un nouveau', async () => {
    const body = {
      ...EMPTY_EXPORT,
      payment_methods: [
        { id: EX_PM1, name: 'Virement', icon: '🔄' }, // existing
        { id: EX_PM2, name: 'Nouveau PM', icon: '💳' }, // new
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    expect(
      ctx.db.prepare("SELECT id FROM payment_methods WHERE name = 'Nouveau PM'").get(),
    ).toBeDefined();
  });

  // ─── insertTransactions ───────────────────────────────────────────────────

  it('importe des transactions avec mapping subcategory/payment_method, ignore compte inconnu', async () => {
    const body = {
      ...EMPTY_EXPORT,
      account_types: [courantAtExport],
      banks: [defaultBankExport],
      accounts: [makeExportAccount(EX_ACC1, 'Compte Tx')],
      categories: [
        {
          id: EX_CAT1,
          name: 'Alimentation',
          icon: '🍴',
          subcategories: [{ id: EX_SC1, name: 'Supermarché' }],
        },
      ],
      payment_methods: [{ id: EX_PM1, name: 'Virement', icon: '🔄' }],
      transactions: [
        makeExportTx(EX_TX1, EX_ACC1, { subcategory_id: EX_SC1, payment_method_id: EX_PM1 }),
        makeExportTx(EX_TX2, EX_ACC1, { type: 'income', amount: 10000 }),
        makeExportTx(EX_TX3, 99), // unknown account → skipped
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    expect(res.body.transactions).toBe(2);
    const count = ctx.db.prepare('SELECT COUNT(*) AS n FROM transactions').get() as { n: number };
    expect(count.n).toBe(2);
    const tx = ctx.db
      .prepare('SELECT subcategory_id, payment_method_id FROM transactions ORDER BY id LIMIT 1')
      .get() as { subcategory_id: number | null; payment_method_id: number | null };
    expect(tx.subcategory_id).not.toBeNull();
    expect(tx.payment_method_id).not.toBeNull();
  });

  // ─── linkTransferPeers ────────────────────────────────────────────────────

  it('importe un virement et lie les deux transactions par transfer_peer_id', async () => {
    const body = {
      ...EMPTY_EXPORT,
      account_types: [courantAtExport],
      banks: [defaultBankExport],
      accounts: [
        makeExportAccount(EX_ACC1, 'Compte From'),
        makeExportAccount(EX_ACC2, 'Compte To'),
      ],
      transactions: [
        makeExportTx(EX_TX1, EX_ACC1, { transfer_peer_id: EX_TX2, type: 'expense' }),
        makeExportTx(EX_TX2, EX_ACC2, { transfer_peer_id: EX_TX1, type: 'income' }),
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    expect(res.body.transfers).toBe(1);
    const txs = ctx.db
      .prepare('SELECT id, transfer_peer_id FROM transactions ORDER BY id')
      .all() as Array<{ id: number; transfer_peer_id: number | null }>;
    expect(txs).toHaveLength(2);
    expect(txs[0].transfer_peer_id).toBe(txs[1].id);
    expect(txs[1].transfer_peer_id).toBe(txs[0].id);
  });

  it("ne lie pas le peer quand l'autre côté du virement est ignoré (compte inconnu)", async () => {
    const body = {
      ...EMPTY_EXPORT,
      account_types: [courantAtExport],
      banks: [defaultBankExport],
      accounts: [makeExportAccount(EX_ACC1, 'Compte Peer Valid')],
      transactions: [
        makeExportTx(EX_TX1, EX_ACC1, { transfer_peer_id: EX_TX2 }),
        makeExportTx(EX_TX2, 99, { transfer_peer_id: EX_TX1 }), // skipped
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    const txs = ctx.db.prepare('SELECT transfer_peer_id FROM transactions').all() as Array<{
      transfer_peer_id: number | null;
    }>;
    expect(txs).toHaveLength(1);
    expect(txs[0].transfer_peer_id).toBeNull();
  });

  // ─── insertSplits ─────────────────────────────────────────────────────────

  it('importe une transaction avec des splits correctement mappés', async () => {
    const body = {
      ...EMPTY_EXPORT,
      account_types: [courantAtExport],
      banks: [defaultBankExport],
      accounts: [makeExportAccount(EX_ACC1, 'Compte Splits')],
      categories: [
        {
          id: EX_CAT1,
          name: 'Alimentation',
          icon: '🍴',
          subcategories: [
            { id: EX_SC1, name: 'Supermarché' },
            { id: EX_SC2, name: 'Restaurant' },
          ],
        },
      ],
      transactions: [
        makeExportTx(EX_TX1, EX_ACC1, {
          splits: [
            { subcategory_id: EX_SC1, amount: 3000 },
            { subcategory_id: EX_SC2, amount: 2000 },
          ],
        }),
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    const splits = ctx.db.prepare('SELECT * FROM transaction_splits').all();
    expect(splits).toHaveLength(2);
  });

  // ─── importScheduled ──────────────────────────────────────────────────────

  it('importe des transactions planifiées avec et sans to_account_id', async () => {
    const body = {
      ...EMPTY_EXPORT,
      account_types: [courantAtExport],
      banks: [defaultBankExport],
      accounts: [
        makeExportAccount(EX_ACC1, 'Compte Sched'),
        makeExportAccount(EX_ACC2, 'Compte Sched Dest'),
      ],
      scheduled_transactions: [
        {
          id: 10,
          account_id: EX_ACC1,
          type: 'expense' as const,
          amount: 50000,
          description: 'Loyer',
          subcategory_id: null,
          payment_method_id: null,
          notes: null,
          recurrence_unit: 'month',
          recurrence_interval: 1,
          recurrence_day: 1,
          recurrence_month: null,
          to_account_id: null,
          weekend_handling: 'allow',
          start_date: '2024-01-01',
          end_date: null,
          active: 1,
        },
        {
          id: 11,
          account_id: EX_ACC1,
          type: 'expense' as const,
          amount: 20000,
          description: 'Virement planifié',
          subcategory_id: null,
          payment_method_id: null,
          notes: null,
          recurrence_unit: 'month',
          recurrence_interval: 1,
          recurrence_day: null,
          recurrence_month: null,
          to_account_id: EX_ACC2,
          weekend_handling: 'allow',
          start_date: '2024-02-01',
          end_date: null,
          active: 1,
        },
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    expect(res.body.scheduled).toBe(2);
    const scheds = ctx.db
      .prepare('SELECT to_account_id FROM scheduled_transactions ORDER BY id')
      .all() as Array<{ to_account_id: number | null }>;
    expect(scheds[0].to_account_id).toBeNull();
    expect(scheds[1].to_account_id).not.toBeNull();
  });

  it('préserve scheduled_id sur les transactions importées', async () => {
    const body = {
      ...EMPTY_EXPORT,
      account_types: [courantAtExport],
      banks: [defaultBankExport],
      accounts: [makeExportAccount(EX_ACC1, 'Compte Sched')],
      scheduled_transactions: [
        {
          id: 10,
          account_id: EX_ACC1,
          type: 'expense' as const,
          amount: 50000,
          description: 'Loyer',
          subcategory_id: null,
          payment_method_id: null,
          notes: null,
          recurrence_unit: 'month',
          recurrence_interval: 1,
          recurrence_day: 1,
          recurrence_month: null,
          to_account_id: null,
          weekend_handling: 'allow',
          start_date: '2024-01-01',
          end_date: null,
          active: 1,
          last_generated_until: null,
        },
      ],
      transactions: [
        makeExportTx(EX_TX1, EX_ACC1, {
          amount: 50000,
          description: 'Loyer jan',
          scheduled_id: 10,
        }),
        makeExportTx(EX_TX2, EX_ACC1, {
          amount: 50000,
          description: 'Loyer fév (sans planif)',
          scheduled_id: null,
        }),
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    const txs = ctx.db
      .prepare('SELECT description, scheduled_id FROM transactions ORDER BY description')
      .all() as Array<{ description: string; scheduled_id: number | null }>;
    const sched = ctx.db.prepare('SELECT id FROM scheduled_transactions LIMIT 1').get() as {
      id: number;
    };
    const txWithSched = txs.find((t) => t.description === 'Loyer jan');
    const txWithoutSched = txs.find((t) => t.description === 'Loyer fév (sans planif)');
    expect(txWithSched?.scheduled_id).toBe(sched.id);
    expect(txWithoutSched?.scheduled_id).toBeNull();
  });

  // ─── importStockPositions + importStockOperations ─────────────────────────

  it('importe positions et opérations boursières, ignore opération si compte/tx inconnu', async () => {
    const body = {
      ...EMPTY_EXPORT,
      account_types: [{ id: EX_AT1, name: 'Bourse', is_investment: 1, is_loan: 0 }],
      banks: [defaultBankExport],
      accounts: [makeExportAccount(EX_ACC1, 'Portefeuille Import')],
      transactions: [
        makeExportTx(EX_TX1, EX_ACC1, { amount: 150000, description: 'Achat AAPL' }),
        makeExportTx(EX_TX2, EX_ACC1, { amount: 500, description: 'Frais AAPL' }),
      ],
      stock_positions: [{ account_id: EX_ACC1, ticker: 'AAPL', quantity: 10, avg_price: 15000 }],
      stock_operations: [
        {
          id: 10,
          account_id: EX_ACC1,
          transaction_id: EX_TX1,
          fees_transaction_id: EX_TX2,
          ticker: 'AAPL',
          type: 'buy' as const,
          quantity: 10,
          price_per_share: 15000,
          fees: 500,
          date: '2024-01-15',
        },
        {
          // Unknown account → skipped
          id: 11,
          account_id: 99,
          transaction_id: EX_TX1,
          fees_transaction_id: null,
          ticker: 'AAPL',
          type: 'buy' as const,
          quantity: 5,
          price_per_share: 15000,
          fees: 0,
          date: '2024-01-15',
        },
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    expect(res.body.stockOperations).toBe(1);
    const pos = ctx.db
      .prepare("SELECT quantity FROM stock_positions WHERE ticker = 'AAPL'")
      .get() as { quantity: number } | undefined;
    expect(pos?.quantity).toBe(10);
    const ops = ctx.db.prepare('SELECT fees_transaction_id FROM stock_operations').all() as Array<{
      fees_transaction_id: number | null;
    }>;
    expect(ops).toHaveLength(1);
    expect(ops[0].fees_transaction_id).not.toBeNull();
  });

  // ─── importLoans ──────────────────────────────────────────────────────────

  it('importe un prêt avec ses échéances et deposit_transaction_id mappé', async () => {
    const body = {
      ...EMPTY_EXPORT,
      account_types: [courantAtExport],
      banks: [defaultBankExport],
      accounts: [
        makeExportAccount(EX_ACC1, 'Compte Prêt'),
        makeExportAccount(EX_ACC2, 'Source Prêt'),
        makeExportAccount(EX_ACC3, 'Dépôt Prêt'),
      ],
      transactions: [
        makeExportTx(EX_TX1, EX_ACC3, {
          amount: 1000000,
          type: 'income',
          description: 'Versement prêt',
        }),
      ],
      loans: [
        {
          id: 10,
          account_id: EX_ACC1,
          principal_amount: 1000000,
          interest_rate: 3.5,
          duration_months: 12,
          start_date: '2024-01-01',
          monthly_payment: 90000,
          source_account_id: EX_ACC2,
          deposit_account_id: EX_ACC3,
          deposit_transaction_id: EX_TX1,
          installments: [
            {
              installment_number: 1,
              due_date: '2024-02-01',
              total_amount: 90000,
              principal_amount: 87083,
              interest_amount: 2917,
              transaction_id: null,
            },
          ],
        },
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    expect(res.body.loans).toBe(1);
    expect(ctx.db.prepare('SELECT * FROM loan_installments').all()).toHaveLength(1);
    const loan = ctx.db.prepare('SELECT deposit_transaction_id FROM loans').get() as {
      deposit_transaction_id: number | null;
    };
    expect(loan.deposit_transaction_id).not.toBeNull();
  });

  it('ignore un prêt dupliqué sur le même compte (INSERT OR IGNORE → changes === 0)', async () => {
    const body = {
      ...EMPTY_EXPORT,
      account_types: [courantAtExport],
      banks: [defaultBankExport],
      accounts: [
        makeExportAccount(EX_ACC1, 'Compte Prêt Dup'),
        makeExportAccount(EX_ACC2, 'Source Dup'),
        makeExportAccount(EX_ACC3, 'Dépôt Dup'),
      ],
      loans: [
        {
          id: 10,
          account_id: EX_ACC1,
          principal_amount: 1000000,
          interest_rate: 3.5,
          duration_months: 12,
          start_date: '2024-01-01',
          monthly_payment: 90000,
          source_account_id: EX_ACC2,
          deposit_account_id: EX_ACC3,
          deposit_transaction_id: null,
          installments: [],
        },
        {
          // Same export account_id → maps to same DB account → INSERT OR IGNORE silences duplicate
          id: 11,
          account_id: EX_ACC1,
          principal_amount: 500000,
          interest_rate: 2.5,
          duration_months: 6,
          start_date: '2024-06-01',
          monthly_payment: 85000,
          source_account_id: EX_ACC2,
          deposit_account_id: EX_ACC3,
          deposit_transaction_id: null,
          installments: [],
        },
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    expect(res.body.loans).toBe(1);
    expect(ctx.db.prepare('SELECT * FROM loans').all()).toHaveLength(1);
  });

  // ─── importInsuranceSupports ──────────────────────────────────────────────

  it("importe des supports d'assurance (uc et euro)", async () => {
    const body = {
      ...EMPTY_EXPORT,
      account_types: [courantAtExport],
      banks: [defaultBankExport],
      accounts: [makeExportAccount(EX_ACC1, 'Assurance Import')],
      insurance_supports: [
        {
          id: EX_INS_SUPPORT1,
          account_id: EX_ACC1,
          name: 'MSCI World',
          type: 'uc',
          ticker: 'MSCIW',
        },
        {
          id: EX_INS_SUPPORT2,
          account_id: EX_ACC1,
          name: 'Fonds Euro',
          type: 'euro',
          ticker: null,
        },
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    expect(res.body.insuranceSupports).toBe(2);
    const supports = ctx.db.prepare('SELECT * FROM insurance_supports').all();
    expect(supports).toHaveLength(2);
  });

  it("réutilise un support existant par nom lors d'une seconde importation", async () => {
    const body = {
      ...EMPTY_EXPORT,
      account_types: [courantAtExport],
      banks: [defaultBankExport],
      accounts: [makeExportAccount(EX_ACC1, 'Assurance Reuse')],
      insurance_supports: [
        {
          id: EX_INS_SUPPORT1,
          account_id: EX_ACC1,
          name: 'Fonds Euro Reuse',
          type: 'euro',
          ticker: null,
        },
      ],
    };
    await ctx.agent.post('/api/import/json-full').send(body);
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    expect(res.body.insuranceSupports).toBe(1);
    const supports = ctx.db.prepare('SELECT * FROM insurance_supports').all();
    expect(supports).toHaveLength(1);
  });

  it("ignore un support d'assurance si le compte est inconnu", async () => {
    const body = {
      ...EMPTY_EXPORT,
      insurance_supports: [
        { id: EX_INS_SUPPORT1, account_id: 99, name: 'Support Fantôme', type: 'uc', ticker: null },
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    expect(res.body.insuranceSupports).toBe(0);
  });

  // ─── importInsuranceOperations ────────────────────────────────────────────

  it("importe des opérations d'assurance avec transactions et frais mappés", async () => {
    const body = {
      ...EMPTY_EXPORT,
      account_types: [courantAtExport],
      banks: [defaultBankExport],
      accounts: [makeExportAccount(EX_ACC1, 'Assurance Ops')],
      transactions: [
        makeExportTx(EX_TX1, EX_ACC1, { amount: 100000, description: 'Versement assurance' }),
        makeExportTx(EX_TX2, EX_ACC1, { amount: 500, description: 'Frais assurance' }),
        makeExportTx(EX_TX3, EX_ACC1, { amount: 200, description: 'Prélèvements sociaux' }),
      ],
      insurance_supports: [
        { id: EX_INS_SUPPORT1, account_id: EX_ACC1, name: 'UC Ops', type: 'uc', ticker: 'UCOPS' },
      ],
      insurance_operations: [
        {
          id: EX_INS_OP1,
          account_id: EX_ACC1,
          support_id: EX_INS_SUPPORT1,
          transaction_id: EX_TX1,
          fees_transaction_id: EX_TX2,
          social_fees_transaction_id: EX_TX3,
          type: 'versement',
          amount: 100000,
          fees: 500,
          social_fees: 200,
          date: '2024-01-15',
          arbitrage_peer_id: null,
        },
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    expect(res.body.insuranceOperations).toBe(1);
    const op = ctx.db
      .prepare('SELECT fees_transaction_id, social_fees_transaction_id FROM insurance_operations')
      .get() as { fees_transaction_id: number | null; social_fees_transaction_id: number | null };
    expect(op.fees_transaction_id).not.toBeNull();
    expect(op.social_fees_transaction_id).not.toBeNull();
  });

  it("ignore une opération d'assurance si le compte est inconnu", async () => {
    const body = {
      ...EMPTY_EXPORT,
      account_types: [courantAtExport],
      banks: [defaultBankExport],
      accounts: [makeExportAccount(EX_ACC1, 'Assurance Compte Inconnu')],
      insurance_supports: [
        {
          id: EX_INS_SUPPORT1,
          account_id: EX_ACC1,
          name: 'Support Valide',
          type: 'euro',
          ticker: null,
        },
      ],
      insurance_operations: [
        {
          id: EX_INS_OP1,
          account_id: 99,
          support_id: EX_INS_SUPPORT1,
          transaction_id: null,
          fees_transaction_id: null,
          social_fees_transaction_id: null,
          type: 'versement',
          amount: 10000,
          fees: 0,
          social_fees: 0,
          date: '2024-01-15',
          arbitrage_peer_id: null,
        },
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    expect(res.body.insuranceOperations).toBe(0);
  });

  it("ignore une opération d'assurance si le support est inconnu", async () => {
    const body = {
      ...EMPTY_EXPORT,
      account_types: [courantAtExport],
      banks: [defaultBankExport],
      accounts: [makeExportAccount(EX_ACC1, 'Assurance Support Inconnu')],
      insurance_operations: [
        {
          id: EX_INS_OP1,
          account_id: EX_ACC1,
          support_id: 99,
          transaction_id: null,
          fees_transaction_id: null,
          social_fees_transaction_id: null,
          type: 'versement',
          amount: 10000,
          fees: 0,
          social_fees: 0,
          date: '2024-01-15',
          arbitrage_peer_id: null,
        },
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    expect(res.body.insuranceOperations).toBe(0);
  });

  // ─── linkArbitragePeers ───────────────────────────────────────────────────

  it("lie les opérations d'arbitrage par arbitrage_peer_id", async () => {
    const body = {
      ...EMPTY_EXPORT,
      account_types: [courantAtExport],
      banks: [defaultBankExport],
      accounts: [
        makeExportAccount(EX_ACC1, 'Source Arbitrage'),
        makeExportAccount(EX_ACC2, 'Dest Arbitrage'),
      ],
      insurance_supports: [
        { id: EX_INS_SUPPORT1, account_id: EX_ACC1, name: 'UC Source', type: 'uc', ticker: null },
        { id: EX_INS_SUPPORT2, account_id: EX_ACC2, name: 'UC Dest', type: 'uc', ticker: null },
      ],
      insurance_operations: [
        {
          id: EX_INS_OP1,
          account_id: EX_ACC1,
          support_id: EX_INS_SUPPORT1,
          transaction_id: null,
          fees_transaction_id: null,
          social_fees_transaction_id: null,
          type: 'arbitrage_out',
          amount: 50000,
          fees: 0,
          social_fees: 0,
          date: '2024-06-01',
          arbitrage_peer_id: EX_INS_OP2,
        },
        {
          id: EX_INS_OP2,
          account_id: EX_ACC2,
          support_id: EX_INS_SUPPORT2,
          transaction_id: null,
          fees_transaction_id: null,
          social_fees_transaction_id: null,
          type: 'arbitrage_in',
          amount: 50000,
          fees: 0,
          social_fees: 0,
          date: '2024-06-01',
          arbitrage_peer_id: EX_INS_OP1,
        },
      ],
    };
    const res = await ctx.agent.post('/api/import/json-full').send(body);
    expect(res.status).toBe(201);
    expect(res.body.insuranceOperations).toBe(2);
    const ops = ctx.db
      .prepare('SELECT id, arbitrage_peer_id FROM insurance_operations ORDER BY id')
      .all() as Array<{ id: number; arbitrage_peer_id: number | null }>;
    expect(ops).toHaveLength(2);
    expect(ops[0].arbitrage_peer_id).toBe(ops[1].id);
    expect(ops[1].arbitrage_peer_id).toBe(ops[0].id);
  });
});
