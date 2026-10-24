import supertest from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

describe('/api/accounts', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  it('GET / retourne 401 sans authentification', async () => {
    const res = await supertest(ctx.app).get('/api/accounts');
    expect(res.status).toBe(401);
  });

  it('GET / retourne un tableau vide initialement', async () => {
    const res = await ctx.agent.get('/api/accounts');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST / crée un compte', async () => {
    const res = await ctx.agent.post('/api/accounts').send({
      name: 'Courant',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      initial_balance: 500,
      opening_date: '2020-01-01',
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Courant');
    expect(res.body.initial_balance).toBe(500);
    expect(res.body.user_id).toBe(ctx.userId);
    expect(res.body.bank).toBe('DefaultBank');
    expect(res.body.type).toBe('Courant');
  });

  it('POST / retourne opening_date dans la réponse', async () => {
    const res = await ctx.agent.post('/api/accounts').send({
      name: 'WithDate',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2023-05-10',
    });
    expect(res.status).toBe(201);
    expect(res.body.opening_date).toBe('2023-05-10');
  });

  it('POST / retourne 400 si le nom est manquant', async () => {
    const res = await ctx.agent
      .post('/api/accounts')
      .send({ bank_id: SEED.BANK_ID, account_type_id: SEED.AT_COURANT });
    expect(res.status).toBe(400);
  });

  it('POST / réussit sans opening_date', async () => {
    const res = await ctx.agent
      .post('/api/accounts')
      .send({ name: 'X', bank_id: SEED.BANK_ID, account_type_id: SEED.AT_COURANT });
    expect(res.status).toBe(201);
    expect(res.body.opening_date).toBeNull();
  });

  it('PUT /:id met à jour un compte', async () => {
    const create = await ctx.agent.post('/api/accounts').send({
      name: 'ToUpdate',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2021-06-01',
    });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/accounts/${id}`).send({
      name: 'Updated',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_EPARGNE,
      initial_balance: 0,
      opening_date: '2021-06-01',
    });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
    expect(res.body.bank).toBe('DefaultBank');
    expect(res.body.type).toBe('Épargne');
  });

  it('PUT /:id retourne 404 pour un compte inconnu', async () => {
    const res = await ctx.agent.put('/api/accounts/99999').send({ name: 'x' });
    expect(res.status).toBe(404);
  });

  it('DELETE /:id supprime un compte', async () => {
    const create = await ctx.agent.post('/api/accounts').send({
      name: 'ToDelete',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2022-03-15',
    });
    const id = create.body.id;
    const del = await ctx.agent.delete(`/api/accounts/${id}`);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);
    const get = await ctx.agent.get('/api/accounts');
    expect(get.body.find((a: { id: number }) => a.id === id)).toBeUndefined();
  });

  it('DELETE /:id retourne 404 pour un compte inconnu', async () => {
    const res = await ctx.agent.delete('/api/accounts/99999');
    expect(res.status).toBe(404);
  });

  it('DELETE /:id supprime les transactions associées quand le compte est un prêt', async () => {
    ctx.db
      .prepare(
        "INSERT INTO account_types (user_id, name, envelope_type) VALUES (?, 'Prêt', 'loan')",
      )
      .run(ctx.userId);

    const src = await ctx.agent.post('/api/accounts').send({
      name: 'Source',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      initial_balance: 50000,
      opening_date: '2024-01-01',
    });
    const dep = await ctx.agent.post('/api/accounts').send({
      name: 'Dépôt',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      initial_balance: 0,
      opening_date: '2024-01-01',
    });

    const loan = await ctx.agent.post('/api/loans').send({
      name: 'Pret a supprimer',
      bank_id: SEED.BANK_ID,
      opening_date: '2024-01-01',
      principal_amount: 10000,
      interest_rate: 0,
      duration_months: 12,
      start_date: '2027-02-01',
      source_account_id: src.body.id,
      deposit_account_id: dep.body.id,
    });
    const loanAccountId = loan.body.account_id;

    const del = await ctx.agent.delete(`/api/accounts/${loanAccountId}`);
    expect(del.status).toBe(200);

    // La transaction de versement sur le compte crédité est supprimée
    const depTxs = await ctx.agent.get(`/api/transactions?account_id=${dep.body.id}`);
    expect(depTxs.body.data).toHaveLength(0);

    // Aucune transaction orpheline sur le compte source
    const srcTxs = await ctx.agent.get(`/api/transactions?account_id=${src.body.id}`);
    expect(srcTxs.body.data).toHaveLength(0);
  });
});

describe('POST /api/accounts/:id/close', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  async function createAccount(initialBalance = 0, name = 'Compte test') {
    const res = await ctx.agent.post('/api/accounts').send({
      name,
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      initial_balance: initialBalance,
      opening_date: '2024-01-01',
    });
    return res.body.id as number;
  }

  it('retourne 401 sans authentification', async () => {
    const id = await createAccount();
    const res = await supertest(ctx.app)
      .post(`/api/accounts/${id}/close`)
      .send({ closed_at: '2025-01-01' });
    expect(res.status).toBe(401);
  });

  it('retourne 404 si le compte est introuvable', async () => {
    const res = await ctx.agent.post('/api/accounts/99999/close').send({ closed_at: '2025-01-01' });
    expect(res.status).toBe(404);
  });

  it('retourne 400 si le compte est déjà clôturé', async () => {
    const id = await createAccount();
    await ctx.agent.post(`/api/accounts/${id}/close`).send({ closed_at: '2025-01-01' });
    const res = await ctx.agent.post(`/api/accounts/${id}/close`).send({ closed_at: '2025-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('account.already_closed');
  });

  it('retourne 400 si solde non nul sans compte de destination', async () => {
    const id = await createAccount(1000);
    const res = await ctx.agent.post(`/api/accounts/${id}/close`).send({ closed_at: '2025-01-01' });
    expect(res.status).toBe(400);
  });

  it('clôture le compte quand le solde est nul', async () => {
    const id = await createAccount(0);
    const res = await ctx.agent.post(`/api/accounts/${id}/close`).send({ closed_at: '2025-06-15' });
    expect(res.status).toBe(200);
    expect(res.body.closed_at).toBe('2025-06-15');
    expect(res.body.balance).toBe(0);
  });

  it('crée un virement de clôture et clôture quand le solde est positif', async () => {
    const id = await createAccount(500);
    const targetId = await createAccount(0, 'Compte cible');

    const res = await ctx.agent.post(`/api/accounts/${id}/close`).send({
      closed_at: '2025-01-01',
      transfer_to_account_id: targetId,
    });

    expect(res.status).toBe(200);
    expect(res.body.closed_at).toBe('2025-01-01');
    expect(res.body.balance).toBe(0);

    // Le compte cible a reçu 500€
    const list = await ctx.agent.get('/api/accounts');
    const target = list.body.find((a: { id: number }) => a.id === targetId);
    expect(target.balance).toBe(500);

    // Les deux transactions sont liées (transfer_peer_id)
    const txs = ctx.db
      .prepare('SELECT * FROM transactions WHERE account_id IN (?, ?)')
      .all(id, targetId) as Array<{ id: number; transfer_peer_id: number | null }>;
    expect(txs).toHaveLength(2);
    expect(txs[0].transfer_peer_id).toBe(txs[1].id);
  });

  it('crée un virement inversé quand le solde est négatif', async () => {
    const id = await createAccount(-300);
    const targetId = await createAccount(1000, 'Compte cible');

    const res = await ctx.agent.post(`/api/accounts/${id}/close`).send({
      closed_at: '2025-01-01',
      transfer_to_account_id: targetId,
    });

    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(0);

    // Le compte cible a perdu 300€ (expense)
    const list = await ctx.agent.get('/api/accounts');
    const target = list.body.find((a: { id: number }) => a.id === targetId);
    expect(target.balance).toBe(700);
  });

  it('le compte clôturé apparaît dans GET /accounts avec closed_at', async () => {
    const id = await createAccount(0);
    await ctx.agent.post(`/api/accounts/${id}/close`).send({ closed_at: '2025-03-10' });

    const list = await ctx.agent.get('/api/accounts');
    const closed = list.body.find((a: { id: number }) => a.id === id);
    expect(closed.closed_at).toBe('2025-03-10');
  });
});

describe('POST /api/accounts/:id/reopen', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  async function createClosedAccount() {
    const create = await ctx.agent.post('/api/accounts').send({
      name: 'Compte clôturé',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      initial_balance: 0,
      opening_date: '2024-01-01',
    });
    const id = create.body.id as number;
    await ctx.agent.post(`/api/accounts/${id}/close`).send({ closed_at: '2025-01-01' });
    return id;
  }

  it('retourne 401 sans authentification', async () => {
    const id = await createClosedAccount();
    const res = await supertest(ctx.app).post(`/api/accounts/${id}/reopen`);
    expect(res.status).toBe(401);
  });

  it('retourne 404 si le compte est introuvable', async () => {
    const res = await ctx.agent.post('/api/accounts/99999/reopen');
    expect(res.status).toBe(404);
  });

  it("retourne 400 si le compte n'est pas clôturé", async () => {
    const create = await ctx.agent.post('/api/accounts').send({
      name: 'Actif',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2024-01-01',
    });
    const res = await ctx.agent.post(`/api/accounts/${create.body.id}/reopen`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('account.not_closed');
  });

  it('rouvre le compte et supprime closed_at', async () => {
    const id = await createClosedAccount();
    const res = await ctx.agent.post(`/api/accounts/${id}/reopen`);
    expect(res.status).toBe(200);
    expect(res.body.closed_at).toBeNull();
  });

  it('le compte réouvert réapparaît actif dans GET /accounts', async () => {
    const id = await createClosedAccount();
    await ctx.agent.post(`/api/accounts/${id}/reopen`);

    const list = await ctx.agent.get('/api/accounts');
    const account = list.body.find((a: { id: number }) => a.id === id);
    expect(account.closed_at).toBeNull();
  });
});

describe('favoris', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  async function createAccount(name: string) {
    const res = await ctx.agent.post('/api/accounts').send({
      name,
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      initial_balance: 0,
      opening_date: '2024-01-01',
    });
    return res.body.id as number;
  }

  const setFavorite = (id: number, favorite: boolean) =>
    ctx.agent.put(`/api/accounts/${id}/favorite`).send({ favorite });

  it('un nouveau compte n est pas favori', async () => {
    const id = await createAccount('A');
    const res = await ctx.agent.get('/api/accounts');
    expect(res.body.find((a: { id: number }) => a.id === id).favorite_order).toBeNull();
  });

  it('PUT /:id/favorite ajoute en fin de liste', async () => {
    const a = await createAccount('A');
    const b = await createAccount('B');
    const resA = await setFavorite(a, true);
    const resB = await setFavorite(b, true);
    expect(resA.status).toBe(200);
    expect(resA.body.favorite_order).toBe(0);
    expect(resB.body.favorite_order).toBe(1);
  });

  it('PUT /:id/favorite est sans effet si déjà favori', async () => {
    const a = await createAccount('A');
    const b = await createAccount('B');
    await setFavorite(a, true);
    await setFavorite(b, true);
    const res = await setFavorite(a, true);
    expect(res.body.favorite_order).toBe(0);
  });

  it('PUT /:id/favorite avec false remet à NULL', async () => {
    const a = await createAccount('A');
    await setFavorite(a, true);
    const res = await setFavorite(a, false);
    expect(res.status).toBe(200);
    expect(res.body.favorite_order).toBeNull();
  });

  it('PUT /:id/favorite retourne 400 si le corps est invalide', async () => {
    const a = await createAccount('A');
    const res = await ctx.agent.put(`/api/accounts/${a}/favorite`).send({ favorite: 'oui' });
    expect(res.status).toBe(400);
  });

  it('PUT /:id/favorite retourne 404 si le compte est inconnu', async () => {
    const res = await setFavorite(99999, true);
    expect(res.status).toBe(404);
  });

  it('PUT /:id/favorite retourne 409 pour un compte clôturé', async () => {
    const a = await createAccount('A');
    await ctx.agent.post(`/api/accounts/${a}/close`).send({ closed_at: '2025-01-01' });
    const res = await setFavorite(a, true);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('account.favorite_closed');
  });

  it('PUT /favorites/reorder réordonne les favoris', async () => {
    const a = await createAccount('A');
    const b = await createAccount('B');
    await setFavorite(a, true);
    await setFavorite(b, true);
    const res = await ctx.agent.put('/api/accounts/favorites/reorder').send([
      { id: a, favorite_order: 1 },
      { id: b, favorite_order: 0 },
    ]);
    expect(res.status).toBe(200);
    const list = await ctx.agent.get('/api/accounts');
    const byId = (id: number) =>
      (list.body as { id: number; favorite_order: number | null }[]).find((x) => x.id === id)!;
    expect(byId(a).favorite_order).toBe(1);
    expect(byId(b).favorite_order).toBe(0);
  });

  const reorder = (items: unknown) => ctx.agent.put('/api/accounts/favorites/reorder').send(items);

  it('PUT /favorites/reorder retourne 409 pour un compte non favori', async () => {
    const a = await createAccount('A');
    const res = await reorder([{ id: a, favorite_order: 5 }]);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('account.favorites_out_of_sync');
    const list = await ctx.agent.get('/api/accounts');
    expect(list.body.find((x: { id: number }) => x.id === a).favorite_order).toBeNull();
  });

  it('PUT /favorites/reorder retourne 409 pour un compte clôturé', async () => {
    const a = await createAccount('A');
    await setFavorite(a, true);
    await ctx.agent.post(`/api/accounts/${a}/close`).send({ closed_at: '2025-01-01' });
    const res = await reorder([{ id: a, favorite_order: 0 }]);
    expect(res.status).toBe(409);
  });

  it('PUT /favorites/reorder retourne 409 si un favori manque', async () => {
    const a = await createAccount('A');
    const b = await createAccount('B');
    await setFavorite(a, true);
    await setFavorite(b, true);
    const res = await reorder([{ id: a, favorite_order: 0 }]);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('account.favorites_out_of_sync');
  });

  it('PUT /favorites/reorder retourne 400 pour un ordre négatif', async () => {
    const a = await createAccount('A');
    await setFavorite(a, true);
    const res = await reorder([{ id: a, favorite_order: -1 }]);
    expect(res.status).toBe(400);
  });

  it('PUT /favorites/reorder retourne 400 pour des ids dupliqués', async () => {
    const a = await createAccount('A');
    await setFavorite(a, true);
    const res = await reorder([
      { id: a, favorite_order: 0 },
      { id: a, favorite_order: 1 },
    ]);
    expect(res.status).toBe(400);
  });

  it('PUT /favorites/reorder retourne 400 pour des ordres dupliqués', async () => {
    const a = await createAccount('A');
    const b = await createAccount('B');
    await setFavorite(a, true);
    await setFavorite(b, true);
    const res = await reorder([
      { id: a, favorite_order: 0 },
      { id: b, favorite_order: 0 },
    ]);
    expect(res.status).toBe(400);
  });

  it('PUT /favorites/reorder retourne 400 si le corps est invalide', async () => {
    const res = await ctx.agent.put('/api/accounts/favorites/reorder').send({ id: 1 });
    expect(res.status).toBe(400);
  });

  it('PUT /favorites/reorder retourne 409 si un id est inconnu', async () => {
    const res = await reorder([{ id: 99999, favorite_order: 0 }]);
    expect(res.status).toBe(409);
  });

  it('la clôture retire le favori et la réouverture ne le restaure pas', async () => {
    const a = await createAccount('A');
    await setFavorite(a, true);
    const closed = await ctx.agent
      .post(`/api/accounts/${a}/close`)
      .send({ closed_at: '2025-01-01' });
    expect(closed.body.favorite_order).toBeNull();
    const reopened = await ctx.agent.post(`/api/accounts/${a}/reopen`);
    expect(reopened.body.favorite_order).toBeNull();
  });
});

describe('GET /api/accounts/:id/frequent-transactions', () => {
  let ctx: TestContext;
  let accountId: number;

  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  interface TxOpts {
    type?: 'income' | 'expense';
    description?: string;
    subcategoryId?: number | null;
    paymentMethodId?: number | null;
    date?: string;
    scheduledId?: number | null;
    peerOf?: number | null;
  }

  function insertTx(opts: TxOpts = {}, account = accountId) {
    const res = ctx.db
      .prepare(
        `INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, scheduled_id, transfer_peer_id)
         VALUES (?, ?, ?, 1000, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        ctx.userId,
        account,
        opts.type ?? 'expense',
        opts.description ?? 'Boulangerie',
        opts.subcategoryId === undefined ? SEED.SUBCAT_SUPERMARCHE : opts.subcategoryId,
        opts.date ?? daysAgo(5),
        opts.paymentMethodId === undefined ? SEED.PM_CARTE : opts.paymentMethodId,
        opts.scheduledId ?? null,
        opts.peerOf ?? null,
      );
    return Number(res.lastInsertRowid);
  }

  function insertTwice(opts: TxOpts = {}) {
    return [insertTx(opts), insertTx({ ...opts, date: daysAgo(10) })];
  }

  const get = async () => ctx.agent.get(`/api/accounts/${accountId}/frequent-transactions`);

  beforeEach(async () => {
    ctx = await createTestContext();
    const res = await ctx.agent.post('/api/accounts').send({
      name: 'Courant',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
    });
    accountId = res.body.id as number;
  });

  it('retourne 401 sans authentification', async () => {
    const res = await supertest(ctx.app).get(`/api/accounts/${accountId}/frequent-transactions`);
    expect(res.status).toBe(401);
  });

  it('retourne 404 pour un compte inconnu', async () => {
    const res = await ctx.agent.get('/api/accounts/9999/frequent-transactions');
    expect(res.status).toBe(404);
  });

  it("retourne 404 pour le compte d'un autre utilisateur", async () => {
    const other = Number(
      ctx.db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('other', 'x')
        .lastInsertRowid,
    );
    const otherAccount = Number(
      ctx.db
        .prepare(
          'INSERT INTO accounts (user_id, name, bank_id, account_type_id) VALUES (?, ?, ?, ?)',
        )
        .run(other, 'Autre', SEED.BANK_ID, SEED.AT_COURANT).lastInsertRowid,
    );
    const res = await ctx.agent.get(`/api/accounts/${otherAccount}/frequent-transactions`);
    expect(res.status).toBe(404);
  });

  it('retourne un tableau vide sans transaction', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('groupe les occurrences et expose les champs attendus', async () => {
    insertTwice();
    const res = await get();
    expect(res.body).toEqual([
      {
        type: 'expense',
        description: 'Boulangerie',
        category_id: 3,
        subcategory_id: SEED.SUBCAT_SUPERMARCHE,
        payment_method_id: SEED.PM_CARTE,
        count: 2,
        last_date: daysAgo(5),
      },
    ]);
  });

  it('normalise casse et espaces et garde la variante la plus récente', async () => {
    insertTx({ description: 'boulangerie', date: daysAgo(20) });
    insertTx({ description: '  BOULANGERIE ', date: daysAgo(2) });
    insertTx({ description: 'Boulangerie  ', date: daysAgo(30) });
    const res = await get();
    expect(res.body).toHaveLength(1);
    expect(res.body[0].description).toBe('BOULANGERIE');
    expect(res.body[0].count).toBe(3);
    expect(res.body[0].last_date).toBe(daysAgo(2));
  });

  it('sépare les groupes par type, sous-catégorie et moyen de paiement', async () => {
    insertTwice({ type: 'income' });
    insertTwice({ subcategoryId: SEED.SUBCAT_CINEMA });
    insertTwice({ paymentMethodId: SEED.PM_VIREMENT });
    insertTwice({ paymentMethodId: null });
    insertTwice();
    const res = await get();
    expect(res.body).toHaveLength(5);
  });

  it('trie par count DESC puis dernière date DESC et limite à 5', async () => {
    insertTx({ description: 'A', date: daysAgo(50) });
    insertTx({ description: 'A', date: daysAgo(51) });
    insertTx({ description: 'A', date: daysAgo(52) });
    for (const [i, name] of ['B', 'C', 'D', 'E', 'F'].entries()) {
      insertTx({ description: name, date: daysAgo(i + 1) });
      insertTx({ description: name, date: daysAgo(i + 60) });
    }
    const res = await get();
    expect(res.body.map((r: { description: string }) => r.description)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
    ]);
  });

  it('exclut les transferts', async () => {
    const peer = insertTx({ description: 'Peer' });
    insertTx({ description: 'Virement', peerOf: peer });
    insertTx({ description: 'Virement', peerOf: peer, date: daysAgo(9) });
    expect((await get()).body).toEqual([]);
  });

  it('exclut les transactions ventilées', async () => {
    const ids = insertTwice({ description: 'Courses' });
    for (const id of ids) {
      ctx.db
        .prepare(
          'INSERT INTO transaction_splits (user_id, transaction_id, subcategory_id, amount) VALUES (?, ?, ?, 500)',
        )
        .run(ctx.userId, id, SEED.SUBCAT_SUPERMARCHE);
    }
    expect((await get()).body).toEqual([]);
  });

  it('exclut les transactions issues du planificateur', async () => {
    const sched = Number(
      ctx.db
        .prepare(
          `INSERT INTO scheduled_transactions (user_id, account_id, type, amount, description, recurrence_unit, start_date)
           VALUES (?, ?, 'expense', 1000, 'Loyer', 'month', '2024-01-01')`,
        )
        .run(ctx.userId, accountId).lastInsertRowid,
    );
    insertTwice({ scheduledId: sched });
    expect((await get()).body).toEqual([]);
  });

  it('exclut les transactions sans sous-catégorie', async () => {
    insertTwice({ subcategoryId: null });
    expect((await get()).body).toEqual([]);
  });

  it('exclut les transactions de plus de 6 mois', async () => {
    insertTx({ date: daysAgo(400) });
    insertTx({ date: daysAgo(300) });
    insertTx({ date: daysAgo(5) });
    expect((await get()).body).toEqual([]);
  });

  it('exclut les transactions à date future', async () => {
    insertTx({ date: daysAgo(-3) });
    insertTx({ date: daysAgo(-10) });
    insertTx({ date: daysAgo(5) });
    expect((await get()).body).toEqual([]);
  });

  it('exclut les transferts sans pair (moyen de paiement transfert)', async () => {
    insertTwice({ paymentMethodId: SEED.PM_TRANSFERT });
    expect((await get()).body).toEqual([]);
  });

  it('exclut les transferts sans pair (sous-catégorie transfert)', async () => {
    insertTwice({ subcategoryId: SEED.SUBCAT_TRANSFERT });
    expect((await get()).body).toEqual([]);
  });

  it('inclut les transactions importées', async () => {
    const tx = (date: string) => ({
      account_id: accountId,
      new_account_source_name: null,
      type: 'expense',
      amount: 12,
      description: 'Boulangerie',
      subcategory_id: SEED.SUBCAT_SUPERMARCHE,
      new_subcategory_key: null,
      date,
      notes: null,
      validated: false,
    });
    const imp = await ctx.agent.post('/api/import/structured').send({
      newAccounts: [],
      newSubcategories: [],
      transactions: [tx(daysAgo(5)), tx(daysAgo(10))],
      transfers: [],
    });
    expect(imp.status).toBe(201);
    const res = await get();
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ description: 'Boulangerie', count: 2 });
  });

  it('exclut les occurrences uniques', async () => {
    insertTx();
    expect((await get()).body).toEqual([]);
  });

  it("ignore les transactions d'un autre compte", async () => {
    const res = await ctx.agent.post('/api/accounts').send({
      name: 'Second',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
    });
    insertTx({}, res.body.id as number);
    insertTx({ date: daysAgo(9) }, res.body.id as number);
    expect((await get()).body).toEqual([]);
  });
});
