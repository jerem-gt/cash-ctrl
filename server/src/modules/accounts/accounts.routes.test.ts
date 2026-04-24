import supertest from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

describe('/api/accounts', () => {
  let ctx: TestContext;

  beforeAll(async () => { ctx = await createTestContext(); });

  it('GET / returns 401 without auth', async () => {
    const res = await supertest(ctx.app).get('/api/accounts');
    expect(res.status).toBe(401);
  });

  it('GET / returns empty array initially', async () => {
    const res = await ctx.agent.get('/api/accounts');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST / creates an account', async () => {
    const res = await ctx.agent.post('/api/accounts').send({
      name: 'Courant', bank_id: SEED.BANK_ID, account_type_id: SEED.AT_COURANT, initial_balance: 500, opening_date: '2020-01-01',
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Courant');
    expect(res.body.initial_balance).toBe(500);
    expect(res.body.user_id).toBe(ctx.userId);
    expect(res.body.bank).toBe('DefaultBank');
    expect(res.body.type).toBe('Courant');
  });

  it('POST / returns opening_date in response', async () => {
    const res = await ctx.agent.post('/api/accounts').send({
      name: 'WithDate', bank_id: SEED.BANK_ID, account_type_id: SEED.AT_COURANT, opening_date: '2023-05-10',
    });
    expect(res.status).toBe(201);
    expect(res.body.opening_date).toBe('2023-05-10');
  });

  it('POST / returns 400 on missing name', async () => {
    const res = await ctx.agent.post('/api/accounts').send({ bank_id: SEED.BANK_ID, account_type_id: SEED.AT_COURANT });
    expect(res.status).toBe(400);
  });

  it('POST / returns 400 on missing opening_date', async () => {
    const res = await ctx.agent.post('/api/accounts').send({ name: 'X', bank_id: SEED.BANK_ID, account_type_id: SEED.AT_COURANT });
    expect(res.status).toBe(400);
  });

  it('PUT /:id updates an account', async () => {
    const create = await ctx.agent.post('/api/accounts').send({
      name: 'ToUpdate', bank_id: SEED.BANK_ID, account_type_id: SEED.AT_COURANT, opening_date: '2021-06-01',
    });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/accounts/${id}`).send({
      name: 'Updated', bank_id: SEED.BANK_ID, account_type_id: SEED.AT_EPARGNE, initial_balance: 0, opening_date: '2021-06-01',
    });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
    expect(res.body.bank).toBe('DefaultBank');
    expect(res.body.type).toBe('Épargne');
  });

  it('PUT /:id returns 404 for unknown account', async () => {
    const res = await ctx.agent.put('/api/accounts/99999').send({ name: 'x' });
    expect(res.status).toBe(404);
  });

  it('DELETE /:id deletes an account', async () => {
    const create = await ctx.agent.post('/api/accounts').send({
      name: 'ToDelete', bank_id: SEED.BANK_ID, account_type_id: SEED.AT_COURANT, opening_date: '2022-03-15',
    });
    const id = create.body.id;
    const del = await ctx.agent.delete(`/api/accounts/${id}`);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);
    const get = await ctx.agent.get('/api/accounts');
    expect(get.body.find((a: { id: number }) => a.id === id)).toBeUndefined();
  });

  it('DELETE /:id returns 404 for unknown account', async () => {
    const res = await ctx.agent.delete('/api/accounts/99999');
    expect(res.status).toBe(404);
  });
});
