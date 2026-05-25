import { beforeAll, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

const TODAY = new Date().toISOString().split('T')[0];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

const base = {
  type: 'expense' as const,
  amount: 100,
  description: 'Loyer',
  subcategory_id: SEED.SUBCAT_LOYER,
  payment_method_id: SEED.PM_VIREMENT,
  recurrence_unit: 'month' as const,
  recurrence_interval: 1,
  start_date: TODAY,
  active: true,
};

const versementBase = {
  type: 'expense' as const,
  amount: 200,
  description: 'Versement PER mensuel',
  recurrence_unit: 'month' as const,
  recurrence_interval: 1,
  start_date: TODAY,
  active: true,
};

describe('/api/scheduled', () => {
  let ctx: TestContext;
  let accountId: number;
  let account2Id: number;
  let avAccountId: number;
  let supportId: number;

  beforeAll(async () => {
    ctx = await createTestContext();
    const acc = await ctx.agent.post('/api/accounts').send({
      name: 'Main',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2020-01-01',
    });
    accountId = acc.body.id;

    const acc2 = await ctx.agent.post('/api/accounts').send({
      name: 'Épargne',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_EPARGNE,
      opening_date: '2020-01-01',
    });
    account2Id = acc2.body.id;

    const avAcc = await ctx.agent.post('/api/accounts').send({
      name: 'Mon PER',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_PER,
      opening_date: '2020-01-01',
    });
    avAccountId = avAcc.body.id;

    const sup = await ctx.agent
      .post(`/api/insurance/${avAccountId}/supports`)
      .send({ account_id: avAccountId, name: 'Fonds Euro', type: 'euro' });
    supportId = sup.body.id;
  });

  it('GET / returns array with transaction_count', async () => {
    const res = await ctx.agent.get('/api/scheduled');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(typeof res.body[0].transaction_count).toBe('number');
    }
  });

  it('POST / creates a scheduled transaction with transaction_count', async () => {
    const res = await ctx.agent.post('/api/scheduled').send({ ...base, account_id: accountId });
    expect(res.status).toBe(201);
    expect(res.body.description).toBe('Loyer');
    expect(res.body.recurrence_unit).toBe('month');
    expect(typeof res.body.transaction_count).toBe('number');
  });

  it('POST / returns 400 when payment_method is Transfert but no to_account_id', async () => {
    const res = await ctx.agent.post('/api/scheduled').send({
      ...base,
      account_id: accountId,
      payment_method_id: SEED.PM_TRANSFERT,
    });
    expect(res.status).toBe(400);
  });

  it('POST / returns 400 when Transfert accounts are identical', async () => {
    const res = await ctx.agent.post('/api/scheduled').send({
      ...base,
      account_id: accountId,
      payment_method_id: SEED.PM_TRANSFERT,
      to_account_id: accountId,
    });
    expect(res.status).toBe(400);
  });

  it('POST / returns 400 on missing required fields', async () => {
    const res = await ctx.agent.post('/api/scheduled').send({ account_id: accountId });
    expect(res.status).toBe(400);
  });

  it('PUT /:id updates a scheduled transaction', async () => {
    const create = await ctx.agent
      .post('/api/scheduled')
      .send({ ...base, account_id: accountId, amount: 50 });
    const id = create.body.id;
    const res = await ctx.agent
      .put(`/api/scheduled/${id}`)
      .send({ ...base, account_id: accountId, amount: 75 });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(75);
  });

  it('PUT /:id ne modifie pas les transactions passées lors du changement de montant', async () => {
    const startDate = daysAgo(60);
    const create = await ctx.agent
      .post('/api/scheduled')
      .send({ ...base, account_id: accountId, amount: 100, start_date: startDate });
    expect(create.status).toBe(201);
    const schedId = create.body.id as number;

    const before = await ctx.agent.get(`/api/transactions?scheduled_id=${schedId}&per_page=100`);
    const pastBefore = (before.body.data as { date: string; amount: number }[]).filter(
      (tx) => tx.date <= TODAY,
    );
    expect(pastBefore.length).toBeGreaterThan(0);

    await ctx.agent
      .put(`/api/scheduled/${schedId}`)
      .send({ ...base, account_id: accountId, amount: 200, start_date: startDate });

    const after = await ctx.agent.get(`/api/transactions?scheduled_id=${schedId}&per_page=100`);
    const pastAfter = (after.body.data as { date: string; amount: number }[]).filter(
      (tx) => tx.date <= TODAY,
    );
    expect(pastAfter.length).toBe(pastBefore.length);
    expect(pastAfter.every((tx) => tx.amount === 100)).toBe(true);
  });

  it('PUT /:id returns 404 for unknown schedule', async () => {
    const res = await ctx.agent
      .put('/api/scheduled/99999')
      .send({ ...base, account_id: accountId });
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

  it('POST / crée un versement planifié sur un compte AV/PER', async () => {
    const res = await ctx.agent.post('/api/scheduled').send({
      ...versementBase,
      account_id: avAccountId,
      to_account_id: accountId,
      insurance_support_id: supportId,
      insurance_fees: 0,
    });
    expect(res.status).toBe(201);
    expect(res.body.insurance_support_id).toBe(supportId);
    expect(res.body.insurance_support_name).toBe('Fonds Euro');
  });

  it('POST / retourne 400 si insurance_support_id mais compte non AV/PER', async () => {
    const res = await ctx.agent.post('/api/scheduled').send({
      ...versementBase,
      account_id: accountId,
      to_account_id: account2Id,
      insurance_support_id: supportId,
      insurance_fees: 0,
    });
    expect(res.status).toBe(400);
  });

  it('POST / retourne 400 si versement sans compte source', async () => {
    const res = await ctx.agent.post('/api/scheduled').send({
      ...versementBase,
      account_id: avAccountId,
      insurance_support_id: supportId,
      insurance_fees: 0,
    });
    expect(res.status).toBe(400);
  });

  it('POST / crée un transfert planifié', async () => {
    const res = await ctx.agent.post('/api/scheduled').send({
      ...base,
      account_id: accountId,
      to_account_id: account2Id,
      payment_method_id: SEED.PM_TRANSFERT,
    });
    expect(res.status).toBe(201);
    expect(res.body.to_account_id).toBe(account2Id);
  });
});
