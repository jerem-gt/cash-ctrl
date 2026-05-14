import supertest from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

const TODAY = new Date().toISOString().split('T')[0];

async function setupWithAccount(ctx: TestContext) {
  const acc = await ctx.agent.post('/api/accounts').send({
    name: 'Main',
    bank_id: SEED.BANK_ID,
    account_type_id: SEED.AT_COURANT,
    opening_date: '2020-01-01',
  });
  return acc.body.id as number;
}

describe('/api/transactions', () => {
  let ctx: TestContext;
  let accountId: number;

  beforeAll(async () => {
    ctx = await createTestContext();
    accountId = await setupWithAccount(ctx);
  });

  it('GET / retourne 401 sans authentification', async () => {
    const res = await supertest(ctx.app).get('/api/transactions');
    expect(res.status).toBe(401);
  });

  it('GET / retourne un résultat paginé vide initialement', async () => {
    const res = await ctx.agent.get('/api/transactions');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(1);
  });

  it('POST / crée une transaction', async () => {
    const res = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'income',
      amount: 1000,
      description: 'Salaire',
      subcategory_id: SEED.SUBCAT_SALAIRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(1000);
    expect(res.body.account_name).toBe('Main');
  });

  it('POST / retourne 403 pour un compte non possédé', async () => {
    const res = await ctx.agent.post('/api/transactions').send({
      account_id: 99999,
      type: 'income',
      amount: 100,
      description: 'x',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    expect(res.status).toBe(403);
  });

  it('POST / retourne 400 pour données invalides', async () => {
    const res = await ctx.agent.post('/api/transactions').send({ account_id: accountId });
    expect(res.status).toBe(400);
  });

  it('GET / filtre par type', async () => {
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 50,
      description: 'Courses',
      subcategory_id: SEED.SUBCAT_SUPERMARCHE,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    const res = await ctx.agent.get('/api/transactions?type=expense');
    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { type: string }) => t.type === 'expense')).toBe(true);
  });

  it('PUT /:id met à jour une transaction', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 20,
      description: 'Café',
      subcategory_id: SEED.SUBCAT_CINEMA,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/transactions/${id}`).send({
      account_id: accountId,
      type: 'expense',
      amount: 25,
      description: 'Café maj',
      subcategory_id: SEED.SUBCAT_CINEMA,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(25);
    expect(res.body.description).toBe('Café maj');
  });

  it('PUT /:id retourne 404 pour une transaction inconnue', async () => {
    const res = await ctx.agent.put('/api/transactions/99999').send({
      account_id: accountId,
      type: 'expense',
      amount: 1,
      description: 'x',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    expect(res.status).toBe(404);
  });

  it('PATCH /:id/validate bascule le flag validé', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'income',
      amount: 500,
      description: 'Prime',
      subcategory_id: SEED.SUBCAT_SALAIRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    const id = create.body.id;
    const res = await ctx.agent.patch(`/api/transactions/${id}/validate`).send({ validated: true });
    expect(res.status).toBe(200);
    expect(res.body.validated).toBe(1);
  });

  it('DELETE /:id supprime une transaction', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 10,
      description: 'ToDelete',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    const id = create.body.id;
    const del = await ctx.agent.delete(`/api/transactions/${id}`);
    expect(del.status).toBe(200);
  });

  it('DELETE /:id retourne 404 pour une transaction inconnue', async () => {
    const res = await ctx.agent.delete('/api/transactions/99999');
    expect(res.status).toBe(404);
  });

  // ─── Ventilation (splits) ──────────────────────────────────────────────────

  it('POST / crée une transaction ventilée et retourne les splits', async () => {
    const res = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 500,
      description: 'Assurance',
      splits: [
        { subcategory_id: SEED.SUBCAT_AUTRE, amount: 200 },
        { subcategory_id: SEED.SUBCAT_LOYER, amount: 300 },
      ],
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    expect(res.status).toBe(201);
    expect(res.body.subcategory_id).toBeNull();
    expect(res.body.splits).toHaveLength(2);
  });

  it('POST / retourne 400 si ni subcategory_id ni splits ne sont fournis', async () => {
    const res = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 100,
      description: 'Test',
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    expect(res.status).toBe(400);
  });

  it('POST / retourne 400 si subcategory_id et splits sont fournis simultanément', async () => {
    const res = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 100,
      description: 'Test',
      subcategory_id: SEED.SUBCAT_AUTRE,
      splits: [{ subcategory_id: SEED.SUBCAT_CINEMA, amount: 100 }],
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    expect(res.status).toBe(400);
  });

  it('PUT /:id passe une transaction normale en ventilée', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 200,
      description: 'Multi-poste',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/transactions/${id}`).send({
      account_id: accountId,
      type: 'expense',
      amount: 200,
      description: 'Multi-poste ventilé',
      splits: [
        { subcategory_id: SEED.SUBCAT_AUTRE, amount: 100 },
        { subcategory_id: SEED.SUBCAT_CINEMA, amount: 100 },
      ],
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
      validated: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.subcategory_id).toBeNull();
    expect(res.body.splits).toHaveLength(2);
  });

  it('GET / inclut les splits pour les transactions ventilées', async () => {
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 300,
      description: 'Ventilée-list',
      splits: [
        { subcategory_id: SEED.SUBCAT_AUTRE, amount: 150 },
        { subcategory_id: SEED.SUBCAT_LOYER, amount: 150 },
      ],
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    const res = await ctx.agent.get('/api/transactions');
    const tx = res.body.data.find(
      (t: { description: string }) => t.description === 'Ventilée-list',
    );
    expect(tx).toBeDefined();
    expect(tx.splits).toHaveLength(2);
  });

  // ─── Filtres supplémentaires ───────────────────────────────────────────────

  it('GET / filtre par account_id', async () => {
    const acc2 = await ctx.agent.post('/api/accounts').send({
      name: 'Épargne',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_EPARGNE,
      opening_date: '2021-01-01',
    });
    const acc2Id = acc2.body.id as number;
    await ctx.agent.post('/api/transactions').send({
      account_id: acc2Id,
      type: 'income',
      amount: 50,
      description: 'Intérêts',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    const res = await ctx.agent.get(`/api/transactions?account_id=${acc2Id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { account_id: number }) => t.account_id === acc2Id)).toBe(true);
  });

  it('GET / filtre par subcategory_id', async () => {
    const res = await ctx.agent.get(`/api/transactions?subcategory_id=${SEED.SUBCAT_SALAIRE}`);
    expect(res.status).toBe(200);
    expect(
      res.body.data.every(
        (t: { subcategory_id: number }) => t.subcategory_id === SEED.SUBCAT_SALAIRE,
      ),
    ).toBe(true);
  });

  it('GET / pagination limit=1 retourne une seule transaction', async () => {
    const res = await ctx.agent.get('/api/transactions?limit=1&page=1');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.totalPages).toBeGreaterThan(1);
  });

  it('GET / retourne 400 pour un paramètre type invalide', async () => {
    const res = await ctx.agent.get('/api/transactions?type=invalid');
    expect(res.status).toBe(400);
  });

  // ─── PUT /:id cas limites ──────────────────────────────────────────────────

  it('PUT /:id retourne 400 pour données invalides', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 10,
      description: 'Test400',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/transactions/${id}`).send({ amount: -1 });
    expect(res.status).toBe(400);
  });

  it('PUT /:id retourne 403 pour un compte non possédé', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 10,
      description: 'Test403',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/transactions/${id}`).send({
      account_id: 99999,
      type: 'expense',
      amount: 10,
      description: 'Test403',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    expect(res.status).toBe(403);
  });

  // ─── PATCH /:id/validate cas limites ──────────────────────────────────────

  it('PATCH /:id/validate retourne 404 pour une transaction inconnue', async () => {
    const res = await ctx.agent.patch('/api/transactions/99999/validate').send({ validated: true });
    expect(res.status).toBe(404);
  });

  it('PATCH /:id/validate retourne 400 pour un body invalide', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'income',
      amount: 100,
      description: 'ValidateTest',
      subcategory_id: SEED.SUBCAT_SALAIRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    const id = create.body.id;
    const res = await ctx.agent.patch(`/api/transactions/${id}/validate`).send({});
    expect(res.status).toBe(400);
  });

  it('PATCH /:id/validate peut dévalider une transaction', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'income',
      amount: 100,
      description: 'Devalider',
      subcategory_id: SEED.SUBCAT_SALAIRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
      validated: true,
    });
    const id = create.body.id;
    await ctx.agent.patch(`/api/transactions/${id}/validate`).send({ validated: true });
    const res = await ctx.agent
      .patch(`/api/transactions/${id}/validate`)
      .send({ validated: false });
    expect(res.status).toBe(200);
    expect(res.body.validated).toBe(0);
  });
});

// ─── Pagination & Solde ────────────────────────────────────────────────────────

describe('/api/transactions — Pagination & Solde', () => {
  let ctx: TestContext;
  let accountId: number;

  beforeAll(async () => {
    ctx = await createTestContext();
    accountId = await setupWithAccount(ctx);
  });

  it('retourne un résultat vide initialement', async () => {
    const res = await ctx.agent.get(`/api/transactions?account_id=${accountId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.balance_before_page).toBe(0);
  });

  it('calcule correctement balance_before_page sur la page 2', async () => {
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'income',
      amount: 100,
      description: 'Salaire',
      subcategory_id: SEED.SUBCAT_SALAIRE,
      date: '2024-01-01',
      payment_method_id: SEED.PM_VIREMENT,
    });
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 30,
      description: 'Courses',
      subcategory_id: SEED.SUBCAT_SUPERMARCHE,
      date: '2024-01-02',
      payment_method_id: SEED.PM_VIREMENT,
    });
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 20,
      description: 'Loisirs',
      subcategory_id: SEED.SUBCAT_CINEMA,
      date: '2024-01-03',
      payment_method_id: SEED.PM_VIREMENT,
    });

    const resPage1 = await ctx.agent.get(
      `/api/transactions?account_id=${accountId}&limit=2&page=1`,
    );
    expect(resPage1.body.data).toHaveLength(2);
    expect(resPage1.body.balance_before_page).toBe(0);
    expect(resPage1.body.total).toBe(3);

    // Tri DESC par date : les deux transactions les plus récentes (-30, -20) sont en page 1
    const resPage2 = await ctx.agent.get(
      `/api/transactions?account_id=${accountId}&limit=2&page=2`,
    );
    expect(resPage2.body.data).toHaveLength(1);
    expect(resPage2.body.data[0].description).toBe('Salaire');
    expect(resPage2.body.balance_before_page).toBe(-50);
  });

  it('trie par ID pour les transactions à date identique', async () => {
    const commonDate = '2024-05-01';
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'income',
      amount: 1000,
      date: commonDate,
      description: 'Premier',
      subcategory_id: SEED.SUBCAT_CINEMA,
      payment_method_id: SEED.PM_VIREMENT,
    });
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 200,
      date: commonDate,
      description: 'Second',
      subcategory_id: SEED.SUBCAT_CINEMA,
      payment_method_id: SEED.PM_VIREMENT,
    });

    const res = await ctx.agent.get(`/api/transactions?account_id=${accountId}&limit=1&page=2`);
    expect(res.body.data[0].description).toBe('Premier');
    expect(res.body.balance_before_page).toBe(-200);
  });
});
