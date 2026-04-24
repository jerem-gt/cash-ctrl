import { describe, it, expect, beforeAll } from 'vitest';
import { createTestContext, type TestContext } from '../helpers/testApp.js';
import { SEED } from '../helpers/testDb.js';

const TODAY = new Date().toISOString().split('T')[0];

const base = {
  type: 'expense' as const,
  amount: 100,
  description: 'Loyer',
  category_id: SEED.CAT_LOYER,
  payment_method_id: SEED.PM_VIREMENT,
  recurrence_unit: 'month' as const,
  recurrence_interval: 1,
  start_date: TODAY,
  active: true,
};

describe('/api/scheduled', () => {
  let ctx: TestContext;
  let accountId: number;

  beforeAll(async () => {
    ctx = await createTestContext();
    const acc = await ctx.agent.post('/api/accounts').send({
      name: 'Main', bank_id: SEED.BANK_ID, account_type_id: SEED.AT_COURANT, opening_date: '2020-01-01',
    });
    accountId = acc.body.id;
  });

  it('GET / returns array', async () => {
    const res = await ctx.agent.get('/api/scheduled');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST / creates a scheduled transaction', async () => {
    const res = await ctx.agent.post('/api/scheduled').send({ ...base, account_id: accountId });
    expect(res.status).toBe(201);
    expect(res.body.description).toBe('Loyer');
    expect(res.body.recurrence_unit).toBe('month');
  });

  it('POST / returns 400 when payment_method is Transfert but no to_account_id', async () => {
    const res = await ctx.agent.post('/api/scheduled').send({
      ...base, account_id: accountId, payment_method_id: SEED.PM_TRANSFERT,
    });
    expect(res.status).toBe(400);
  });

  it('POST / returns 400 when Transfert accounts are identical', async () => {
    const res = await ctx.agent.post('/api/scheduled').send({
      ...base, account_id: accountId, payment_method_id: SEED.PM_TRANSFERT, to_account_id: accountId,
    });
    expect(res.status).toBe(400);
  });

  it('POST / returns 400 on missing required fields', async () => {
    const res = await ctx.agent.post('/api/scheduled').send({ account_id: accountId });
    expect(res.status).toBe(400);
  });

  it('PUT /:id updates a scheduled transaction', async () => {
    const create = await ctx.agent.post('/api/scheduled').send({ ...base, account_id: accountId, amount: 50 });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/scheduled/${id}`).send({ ...base, account_id: accountId, amount: 75 });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(75);
  });

  it('PUT /:id returns 404 for unknown schedule', async () => {
    const res = await ctx.agent.put('/api/scheduled/99999').send({ ...base, account_id: accountId });
    expect(res.status).toBe(404);
  });

  it('DELETE /:id removes a scheduled transaction', async () => {
    const create = await ctx.agent.post('/api/scheduled').send({ ...base, account_id: accountId });
    const res = await ctx.agent.delete(`/api/scheduled/${create.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('DELETE /:id returns 404 for unknown schedule', async () => {
    expect((await ctx.agent.delete('/api/scheduled/99999')).status).toBe(404);
  });
});
