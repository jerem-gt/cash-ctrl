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

async function createExpense(ctx: TestContext, accountId: number) {
  const res = await ctx.agent.post('/api/transactions').send({
    account_id: accountId,
    type: 'expense',
    amount: 150,
    description: 'Médecin',
    subcategory_id: SEED.SUBCAT_AUTRE,
    date: TODAY,
    payment_method_id: SEED.PM_CARTE,
  });
  return res.body.id as number;
}

async function createIncome(ctx: TestContext, accountId: number) {
  const res = await ctx.agent.post('/api/transactions').send({
    account_id: accountId,
    type: 'income',
    amount: 90,
    description: 'Remboursement CPAM',
    subcategory_id: SEED.SUBCAT_SALAIRE,
    date: TODAY,
    payment_method_id: SEED.PM_VIREMENT,
  });
  return res.body.id as number;
}

describe('/api/reimbursements', () => {
  let ctx: TestContext;
  let accountId: number;

  beforeAll(async () => {
    ctx = await createTestContext();
    accountId = await setupWithAccount(ctx);
  });

  it('GET /pending retourne 401 sans auth', async () => {
    const res = await supertest(ctx.app).get('/api/reimbursements/pending');
    expect(res.status).toBe(401);
  });

  it('GET /pending retourne un tableau vide initialement', async () => {
    const res = await ctx.agent.get('/api/reimbursements/pending');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /pending retourne les dépenses en_attente avec total_reimbursed', async () => {
    const expenseId = await createExpense(ctx, accountId);
    await ctx.agent
      .patch(`/api/reimbursements/${expenseId}/status`)
      .send({ reimbursement_status: 'en_attente' });

    const incomeId = await createIncome(ctx, accountId);
    await ctx.agent
      .post(`/api/reimbursements/${expenseId}`)
      .send({ linked_transaction_id: incomeId });

    const res = await ctx.agent.get('/api/reimbursements/pending');
    expect(res.status).toBe(200);
    const item = res.body.find((i: { id: number }) => i.id === expenseId);
    expect(item).toBeDefined();
    expect(item.amount).toBe(150);
    expect(item.total_reimbursed).toBe(90);
  });

  it("GET /pending n'inclut pas les dépenses avec status rembourse", async () => {
    const expenseId = await createExpense(ctx, accountId);
    await ctx.agent
      .patch(`/api/reimbursements/${expenseId}/status`)
      .send({ reimbursement_status: 'rembourse' });

    const res = await ctx.agent.get('/api/reimbursements/pending');
    expect(res.body.find((i: { id: number }) => i.id === expenseId)).toBeUndefined();
  });

  it("GET /:transactionId retourne un tableau vide si aucun remboursement n'est lié", async () => {
    const expenseId = await createExpense(ctx, accountId);
    const res = await ctx.agent.get(`/api/reimbursements/${expenseId}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /:transactionId lie une transaction de revenu', async () => {
    const expenseId = await createExpense(ctx, accountId);
    const incomeId = await createIncome(ctx, accountId);

    const res = await ctx.agent
      .post(`/api/reimbursements/${expenseId}`)
      .send({ linked_transaction_id: incomeId });

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(incomeId);
    expect(res.body[0].amount).toBe(90);
    expect(res.body[0].description).toBe('Remboursement CPAM');
  });

  it('POST /:transactionId retourne 400 si la dépense cible est un revenu', async () => {
    const incomeId = await createIncome(ctx, accountId);
    const otherIncomeId = await createIncome(ctx, accountId);

    const res = await ctx.agent
      .post(`/api/reimbursements/${incomeId}`)
      .send({ linked_transaction_id: otherIncomeId });

    expect(res.status).toBe(400);
  });

  it('POST /:transactionId retourne 400 si la transaction liée est une dépense', async () => {
    const expenseId = await createExpense(ctx, accountId);
    const otherExpenseId = await createExpense(ctx, accountId);

    const res = await ctx.agent
      .post(`/api/reimbursements/${expenseId}`)
      .send({ linked_transaction_id: otherExpenseId });

    expect(res.status).toBe(400);
  });

  it('POST /:transactionId retourne 404 pour une transaction inconnue', async () => {
    const res = await ctx.agent
      .post('/api/reimbursements/99999')
      .send({ linked_transaction_id: 1 });
    expect(res.status).toBe(404);
  });

  it('POST /:transactionId ignore les doublons (idempotent)', async () => {
    const expenseId = await createExpense(ctx, accountId);
    const incomeId = await createIncome(ctx, accountId);

    await ctx.agent
      .post(`/api/reimbursements/${expenseId}`)
      .send({ linked_transaction_id: incomeId });
    const res = await ctx.agent
      .post(`/api/reimbursements/${expenseId}`)
      .send({ linked_transaction_id: incomeId });

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(1);
  });

  it('DELETE /:transactionId/:linkedId délie une transaction', async () => {
    const expenseId = await createExpense(ctx, accountId);
    const incomeId = await createIncome(ctx, accountId);

    await ctx.agent
      .post(`/api/reimbursements/${expenseId}`)
      .send({ linked_transaction_id: incomeId });

    const del = await ctx.agent.delete(`/api/reimbursements/${expenseId}/${incomeId}`);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    const list = await ctx.agent.get(`/api/reimbursements/${expenseId}`);
    expect(list.body).toHaveLength(0);
  });

  it('DELETE /:transactionId/:linkedId retourne 404 pour une transaction inconnue', async () => {
    const res = await ctx.agent.delete('/api/reimbursements/99999/1');
    expect(res.status).toBe(404);
  });

  it('PATCH /:transactionId/status met à jour le reimbursement_status', async () => {
    const expenseId = await createExpense(ctx, accountId);

    const res = await ctx.agent
      .patch(`/api/reimbursements/${expenseId}/status`)
      .send({ reimbursement_status: 'en_attente' });

    expect(res.status).toBe(200);
    expect(res.body.reimbursement_status).toBe('en_attente');
  });

  it('PATCH /:transactionId/status accepte null pour désactiver le suivi', async () => {
    const expenseId = await createExpense(ctx, accountId);

    await ctx.agent
      .patch(`/api/reimbursements/${expenseId}/status`)
      .send({ reimbursement_status: 'en_attente' });

    const res = await ctx.agent
      .patch(`/api/reimbursements/${expenseId}/status`)
      .send({ reimbursement_status: null });

    expect(res.status).toBe(200);
    expect(res.body.reimbursement_status).toBeNull();
  });

  it('PATCH /:transactionId/status retourne 400 pour une valeur invalide', async () => {
    const expenseId = await createExpense(ctx, accountId);
    const res = await ctx.agent
      .patch(`/api/reimbursements/${expenseId}/status`)
      .send({ reimbursement_status: 'invalide' });
    expect(res.status).toBe(400);
  });

  it('PATCH /:transactionId/status retourne 404 pour une transaction inconnue', async () => {
    const res = await ctx.agent
      .patch('/api/reimbursements/99999/status')
      .send({ reimbursement_status: 'en_attente' });
    expect(res.status).toBe(404);
  });
});

describe('reimbursement_status dans /api/transactions', () => {
  let ctx: TestContext;
  let accountId: number;

  beforeAll(async () => {
    ctx = await createTestContext();
    accountId = await setupWithAccount(ctx);
  });

  it('POST / crée une transaction avec reimbursement_status en_attente', async () => {
    const res = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 80,
      description: 'Pharmacie',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
      reimbursement_status: 'en_attente',
    });
    expect(res.status).toBe(201);
    expect(res.body.reimbursement_status).toBe('en_attente');
  });

  it('POST / crée une transaction sans reimbursement_status (null par défaut)', async () => {
    const res = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 30,
      description: 'Courses',
      subcategory_id: SEED.SUBCAT_SUPERMARCHE,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    expect(res.status).toBe(201);
    expect(res.body.reimbursement_status).toBeNull();
  });

  it('GET / inclut reimbursement_status dans les résultats', async () => {
    const res = await ctx.agent.get('/api/transactions');
    expect(res.status).toBe(200);
    for (const tx of res.body.data) {
      expect('reimbursement_status' in tx).toBe(true);
    }
  });
});
