import { beforeAll, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

const TODAY = new Date().toISOString().split('T')[0];

describe('/api/transfers', () => {
  let ctx: TestContext;
  let fromId: number;
  let toId: number;

  beforeAll(async () => {
    ctx = await createTestContext();
    const a1 = await ctx.agent.post('/api/accounts').send({
      name: 'From',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2020-01-01',
    });
    const a2 = await ctx.agent.post('/api/accounts').send({
      name: 'To',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_EPARGNE,
      opening_date: '2021-06-01',
    });
    fromId = a1.body.id;
    toId = a2.body.id;
  });

  it('POST / creates paired expense + income', async () => {
    const res = await ctx.agent.post('/api/transfers').send({
      from_account_id: fromId,
      to_account_id: toId,
      amount: 200,
      date: TODAY,
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
      from_account_id: fromId,
      to_account_id: fromId,
      amount: 100,
      date: TODAY,
    });
    expect(res.status).toBe(400);
  });

  it('POST / returns 403 when account does not belong to user', async () => {
    const res = await ctx.agent.post('/api/transfers').send({
      from_account_id: fromId,
      to_account_id: 99999,
      amount: 100,
      date: TODAY,
    });
    expect(res.status).toBe(403);
  });

  it('POST / returns 400 on missing fields', async () => {
    const res = await ctx.agent.post('/api/transfers').send({ from_account_id: fromId });
    expect(res.status).toBe(400);
  });

  it('PUT /:id updates both legs of the transfer', async () => {
    const create = await ctx.agent.post('/api/transfers').send({
      from_account_id: fromId,
      to_account_id: toId,
      amount: 100,
      date: TODAY,
    });
    const expenseId = create.body.expense.id;

    const res = await ctx.agent.put(`/api/transfers/${expenseId}`).send({
      amount: 150,
      description: 'Virement modifié',
      date: TODAY,
      validated: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(150);
    expect(res.body.description).toBe('Virement modifié');
    expect(res.body.validated).toBe(1);
  });

  it('PUT /:id returns 400 on a non-transfer transaction', async () => {
    const txRes = await ctx.agent.post('/api/transactions').send({
      account_id: fromId,
      type: 'expense',
      amount: 10,
      description: 'Café',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
      notes: null,
      validated: false,
    });
    const res = await ctx.agent.put(`/api/transfers/${txRes.body.id}`).send({
      amount: 20,
      description: 'Test',
      date: TODAY,
      validated: false,
    });
    expect(res.status).toBe(400);
  });

  it('DELETE /:id deletes both legs of the transfer', async () => {
    const create = await ctx.agent.post('/api/transfers').send({
      from_account_id: fromId,
      to_account_id: toId,
      amount: 50,
      date: TODAY,
    });
    const expenseId = create.body.expense.id;
    const incomeId = create.body.income.id;

    const del = await ctx.agent.delete(`/api/transfers/${expenseId}`);
    expect(del.status).toBe(200);

    const check = await ctx.agent.get('/api/transactions');
    const ids = check.body.data.map((t: { id: number }) => t.id);
    expect(ids).not.toContain(expenseId);
    expect(ids).not.toContain(incomeId);
  });

  it('DELETE /:id returns 400 on a non-transfer transaction', async () => {
    const txRes = await ctx.agent.post('/api/transactions').send({
      account_id: fromId,
      type: 'expense',
      amount: 10,
      description: 'Café',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
      notes: null,
      validated: false,
    });
    const res = await ctx.agent.delete(`/api/transfers/${txRes.body.id}`);
    expect(res.status).toBe(400);
  });
});
