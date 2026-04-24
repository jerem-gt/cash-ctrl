import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { createTestContext, type TestContext } from '../helpers/testApp.js';
import { SEED } from '../helpers/testDb.js';

const TODAY = new Date().toISOString().split('T')[0];

async function setupWithAccount(ctx: TestContext) {
  const acc = await ctx.agent.post('/api/accounts').send({
    name: 'Main', bank_id: SEED.BANK_ID, account_type_id: SEED.AT_COURANT, opening_date: '2020-01-01',
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

  it('GET / returns 401 without auth', async () => {
    const res = await supertest(ctx.app).get('/api/transactions');
    expect(res.status).toBe(401);
  });

  it('GET / returns empty array initially', async () => {
    const res = await ctx.agent.get('/api/transactions');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST / creates a transaction', async () => {
    const res = await ctx.agent.post('/api/transactions').send({
      account_id: accountId, type: 'income', amount: 1000,
      description: 'Salaire', category_id: SEED.CAT_SALAIRE, date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(1000);
    expect(res.body.account_name).toBe('Main');
  });

  it('POST / returns 403 for a non-owned account', async () => {
    const res = await ctx.agent.post('/api/transactions').send({
      account_id: 99999, type: 'income', amount: 100,
      description: 'x', category_id: SEED.CAT_AUTRE, date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    expect(res.status).toBe(403);
  });

  it('POST / returns 400 for invalid data', async () => {
    const res = await ctx.agent.post('/api/transactions').send({ account_id: accountId });
    expect(res.status).toBe(400);
  });

  it('GET / filters by type', async () => {
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId, type: 'expense', amount: 50,
      description: 'Courses', category_id: SEED.CAT_ALIMENTATION, date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    const res = await ctx.agent.get('/api/transactions?type=expense');
    expect(res.status).toBe(200);
    expect(res.body.every((t: { type: string }) => t.type === 'expense')).toBe(true);
  });

  it('PUT /:id updates a normal transaction', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId, type: 'expense', amount: 20,
      description: 'Café', category_id: SEED.CAT_LOISIRS, date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/transactions/${id}`).send({
      account_id: accountId, type: 'expense', amount: 25,
      description: 'Café maj', category_id: SEED.CAT_LOISIRS, date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(25);
    expect(res.body.description).toBe('Café maj');
  });

  it('PUT /:id returns 404 for unknown transaction', async () => {
    const res = await ctx.agent.put('/api/transactions/99999').send({
      account_id: accountId, type: 'expense', amount: 1,
      description: 'x', category_id: SEED.CAT_AUTRE, date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    expect(res.status).toBe(404);
  });

  it('PATCH /:id/validate toggles validated flag', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId, type: 'income', amount: 500,
      description: 'Prime', category_id: SEED.CAT_SALAIRE, date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    const id = create.body.id;
    const res = await ctx.agent.patch(`/api/transactions/${id}/validate`).send({ validated: true });
    expect(res.status).toBe(200);
    expect(res.body.validated).toBe(1);
  });

  it('DELETE /:id removes a transaction', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId, type: 'expense', amount: 10,
      description: 'ToDelete', category_id: SEED.CAT_AUTRE, date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    const id = create.body.id;
    const del = await ctx.agent.delete(`/api/transactions/${id}`);
    expect(del.status).toBe(200);
  });

  it('DELETE /:id returns 404 for unknown transaction', async () => {
    const res = await ctx.agent.delete('/api/transactions/99999');
    expect(res.status).toBe(404);
  });
});
