import { describe, it, expect, beforeAll } from 'vitest';
import { createTestContext, type TestContext } from '../helpers/testApp.js';

const TODAY = new Date().toISOString().split('T')[0];

describe('/api/transfers', () => {
  let ctx: TestContext;
  let fromId: number;
  let toId: number;

  beforeAll(async () => {
    ctx = await createTestContext();
    const a1 = await ctx.agent.post('/api/accounts').send({ name: 'From', bank: 'X', type: 'Courant' });
    const a2 = await ctx.agent.post('/api/accounts').send({ name: 'To', bank: 'X', type: 'Épargne' });
    fromId = a1.body.id;
    toId   = a2.body.id;
  });

  it('POST / creates paired expense + income', async () => {
    const res = await ctx.agent.post('/api/transfers').send({
      from_account_id: fromId, to_account_id: toId, amount: 200, date: TODAY,
    });
    expect(res.status).toBe(201);
    expect(res.body.expense.type).toBe('expense');
    expect(res.body.income.type).toBe('income');
    expect(res.body.expense.amount).toBe(200);
    expect(res.body.expense.transfer_peer_id).toBe(res.body.income.id);
    expect(res.body.income.transfer_peer_id).toBe(res.body.expense.id);
  });

  it('POST / returns 400 when from === to', async () => {
    const res = await ctx.agent.post('/api/transfers').send({
      from_account_id: fromId, to_account_id: fromId, amount: 100, date: TODAY,
    });
    expect(res.status).toBe(400);
  });

  it('POST / returns 403 when account does not belong to user', async () => {
    const res = await ctx.agent.post('/api/transfers').send({
      from_account_id: fromId, to_account_id: 99999, amount: 100, date: TODAY,
    });
    expect(res.status).toBe(403);
  });

  it('POST / returns 400 on missing fields', async () => {
    const res = await ctx.agent.post('/api/transfers').send({ from_account_id: fromId });
    expect(res.status).toBe(400);
  });

  it('DELETE expense in /api/transactions also deletes income peer', async () => {
    const create = await ctx.agent.post('/api/transfers').send({
      from_account_id: fromId, to_account_id: toId, amount: 50, date: TODAY,
    });
    const expenseId = create.body.expense.id;
    const incomeId  = create.body.income.id;

    const del = await ctx.agent.delete(`/api/transactions/${expenseId}`);
    expect(del.status).toBe(200);

    const check = await ctx.agent.get('/api/transactions');
    const ids = check.body.map((t: { id: number }) => t.id);
    expect(ids).not.toContain(expenseId);
    expect(ids).not.toContain(incomeId);
  });
});
