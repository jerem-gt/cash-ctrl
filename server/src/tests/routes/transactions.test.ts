import { describe, it, expect, beforeAll } from 'vitest';
import { createTestContext, type TestContext } from '../helpers/testApp.js';

const TODAY = new Date().toISOString().split('T')[0];

async function setupWithAccount(ctx: TestContext) {
  const acc = await ctx.agent.post('/api/accounts').send({ name: 'Main', bank: 'BNP', type: 'Courant' });
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
    const { db } = await createTestContext();
    const { createApp } = await import('../../app.js');
    const supertest = (await import('supertest')).default;
    const res = await supertest(createApp(db)).get('/api/transactions');
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
      description: 'Salaire', category: 'Salaire', date: TODAY, payment_method: 'Virement',
    });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(1000);
    expect(res.body.account_name).toBe('Main');
  });

  it('POST / returns 403 for a non-owned account', async () => {
    const res = await ctx.agent.post('/api/transactions').send({
      account_id: 99999, type: 'income', amount: 100,
      description: 'x', category: 'x', date: TODAY, payment_method: 'x',
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
      description: 'Courses', category: 'Alimentation', date: TODAY, payment_method: 'Carte Bancaire',
    });
    const res = await ctx.agent.get('/api/transactions?type=expense');
    expect(res.status).toBe(200);
    expect(res.body.every((t: { type: string }) => t.type === 'expense')).toBe(true);
  });

  it('PUT /:id updates a normal transaction', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId, type: 'expense', amount: 20,
      description: 'Café', category: 'Loisirs', date: TODAY, payment_method: 'Carte Bancaire',
    });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/transactions/${id}`).send({
      account_id: accountId, type: 'expense', amount: 25,
      description: 'Café maj', category: 'Loisirs', date: TODAY, payment_method: 'Carte Bancaire',
    });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(25);
    expect(res.body.description).toBe('Café maj');
  });

  it('PUT /:id returns 404 for unknown transaction', async () => {
    const res = await ctx.agent.put('/api/transactions/99999').send({
      account_id: accountId, type: 'expense', amount: 1,
      description: 'x', category: 'x', date: TODAY, payment_method: 'x',
    });
    expect(res.status).toBe(404);
  });

  it('PATCH /:id/validate toggles validated flag', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId, type: 'income', amount: 500,
      description: 'Prime', category: 'Salaire', date: TODAY, payment_method: 'Virement',
    });
    const id = create.body.id;
    const res = await ctx.agent.patch(`/api/transactions/${id}/validate`).send({ validated: true });
    expect(res.status).toBe(200);
    expect(res.body.validated).toBe(1);
  });

  it('DELETE /:id removes a transaction', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId, type: 'expense', amount: 10,
      description: 'ToDelete', category: 'Autre', date: TODAY, payment_method: 'Carte Bancaire',
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
