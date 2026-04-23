import { describe, it, expect, beforeAll } from 'vitest';
import { createTestContext, type TestContext } from '../helpers/testApp.js';
import { SEED } from '../helpers/testDb.js';

describe('/api/accounts', () => {
  let ctx: TestContext;

  beforeAll(async () => { ctx = await createTestContext(); });

  it('GET / returns 401 without auth', async () => {
    const { db } = await createTestContext();
    const { createApp } = await import('../../app.js');
    const supertest = (await import('supertest')).default;
    const res = await supertest(createApp(db)).get('/api/accounts');
    expect(res.status).toBe(401);
  });

  it('GET / returns empty array initially', async () => {
    const res = await ctx.agent.get('/api/accounts');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST / creates an account', async () => {
    const res = await ctx.agent.post('/api/accounts').send({
      name: 'Courant', bank_id: SEED.BANK_ID, account_type_id: SEED.AT_COURANT, initial_balance: 500,
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Courant');
    expect(res.body.initial_balance).toBe(500);
    expect(res.body.user_id).toBe(ctx.userId);
    expect(res.body.bank).toBe('DefaultBank');
    expect(res.body.type).toBe('Courant');
  });

  it('POST / returns 400 on missing name', async () => {
    const res = await ctx.agent.post('/api/accounts').send({ bank_id: SEED.BANK_ID, account_type_id: SEED.AT_COURANT });
    expect(res.status).toBe(400);
  });

  it('PUT /:id updates an account', async () => {
    const create = await ctx.agent.post('/api/accounts').send({
      name: 'ToUpdate', bank_id: SEED.BANK_ID, account_type_id: SEED.AT_COURANT,
    });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/accounts/${id}`).send({
      name: 'Updated', bank_id: SEED.BANK_ID, account_type_id: SEED.AT_EPARGNE, initial_balance: 0,
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
      name: 'ToDelete', bank_id: SEED.BANK_ID, account_type_id: SEED.AT_COURANT,
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
