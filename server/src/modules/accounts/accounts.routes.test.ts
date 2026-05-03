import supertest from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

describe('/api/accounts', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

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
      name: 'Courant',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      initial_balance: 500,
      opening_date: '2020-01-01',
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
      name: 'WithDate',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2023-05-10',
    });
    expect(res.status).toBe(201);
    expect(res.body.opening_date).toBe('2023-05-10');
  });

  it('POST / returns 400 on missing name', async () => {
    const res = await ctx.agent
      .post('/api/accounts')
      .send({ bank_id: SEED.BANK_ID, account_type_id: SEED.AT_COURANT });
    expect(res.status).toBe(400);
  });

  it('POST / returns 400 on missing opening_date', async () => {
    const res = await ctx.agent
      .post('/api/accounts')
      .send({ name: 'X', bank_id: SEED.BANK_ID, account_type_id: SEED.AT_COURANT });
    expect(res.status).toBe(400);
  });

  it('PUT /:id updates an account', async () => {
    const create = await ctx.agent.post('/api/accounts').send({
      name: 'ToUpdate',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2021-06-01',
    });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/accounts/${id}`).send({
      name: 'Updated',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_EPARGNE,
      initial_balance: 0,
      opening_date: '2021-06-01',
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
      name: 'ToDelete',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2022-03-15',
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

describe('POST /api/accounts/:id/close', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  async function createAccount(initialBalance = 0, name = 'Compte test') {
    const res = await ctx.agent.post('/api/accounts').send({
      name,
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      initial_balance: initialBalance,
      opening_date: '2024-01-01',
    });
    return res.body.id as number;
  }

  it('retourne 401 sans authentification', async () => {
    const id = await createAccount();
    const res = await supertest(ctx.app)
      .post(`/api/accounts/${id}/close`)
      .send({ closed_at: '2025-01-01' });
    expect(res.status).toBe(401);
  });

  it('retourne 404 si le compte est introuvable', async () => {
    const res = await ctx.agent.post('/api/accounts/99999/close').send({ closed_at: '2025-01-01' });
    expect(res.status).toBe(404);
  });

  it('retourne 400 si le compte est déjà clôturé', async () => {
    const id = await createAccount();
    await ctx.agent.post(`/api/accounts/${id}/close`).send({ closed_at: '2025-01-01' });
    const res = await ctx.agent.post(`/api/accounts/${id}/close`).send({ closed_at: '2025-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/déjà clôturé/i);
  });

  it('retourne 400 si solde non nul sans compte de destination', async () => {
    const id = await createAccount(1000);
    const res = await ctx.agent.post(`/api/accounts/${id}/close`).send({ closed_at: '2025-01-01' });
    expect(res.status).toBe(400);
  });

  it('clôture le compte quand le solde est nul', async () => {
    const id = await createAccount(0);
    const res = await ctx.agent.post(`/api/accounts/${id}/close`).send({ closed_at: '2025-06-15' });
    expect(res.status).toBe(200);
    expect(res.body.closed_at).toBe('2025-06-15');
    expect(res.body.balance).toBe(0);
  });

  it('crée un virement de clôture et clôture quand le solde est positif', async () => {
    const id = await createAccount(500);
    const targetId = await createAccount(0, 'Compte cible');

    const res = await ctx.agent.post(`/api/accounts/${id}/close`).send({
      closed_at: '2025-01-01',
      transfer_to_account_id: targetId,
    });

    expect(res.status).toBe(200);
    expect(res.body.closed_at).toBe('2025-01-01');
    expect(res.body.balance).toBe(0);

    // Le compte cible a reçu 500€
    const list = await ctx.agent.get('/api/accounts');
    const target = list.body.find((a: { id: number }) => a.id === targetId);
    expect(target.balance).toBe(500);

    // Les deux transactions sont liées (transfer_peer_id)
    const txs = ctx.db
      .prepare('SELECT * FROM transactions WHERE account_id IN (?, ?)')
      .all(id, targetId) as Array<{ id: number; transfer_peer_id: number | null }>;
    expect(txs).toHaveLength(2);
    expect(txs[0].transfer_peer_id).toBe(txs[1].id);
  });

  it('crée un virement inversé quand le solde est négatif', async () => {
    const id = await createAccount(-300);
    const targetId = await createAccount(1000, 'Compte cible');

    const res = await ctx.agent.post(`/api/accounts/${id}/close`).send({
      closed_at: '2025-01-01',
      transfer_to_account_id: targetId,
    });

    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(0);

    // Le compte cible a perdu 300€ (expense)
    const list = await ctx.agent.get('/api/accounts');
    const target = list.body.find((a: { id: number }) => a.id === targetId);
    expect(target.balance).toBe(700);
  });

  it('le compte clôturé apparaît dans GET /accounts avec closed_at', async () => {
    const id = await createAccount(0);
    await ctx.agent.post(`/api/accounts/${id}/close`).send({ closed_at: '2025-03-10' });

    const list = await ctx.agent.get('/api/accounts');
    const closed = list.body.find((a: { id: number }) => a.id === id);
    expect(closed.closed_at).toBe('2025-03-10');
  });
});

describe('POST /api/accounts/:id/reopen', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  async function createClosedAccount() {
    const create = await ctx.agent.post('/api/accounts').send({
      name: 'Compte clôturé',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      initial_balance: 0,
      opening_date: '2024-01-01',
    });
    const id = create.body.id as number;
    await ctx.agent.post(`/api/accounts/${id}/close`).send({ closed_at: '2025-01-01' });
    return id;
  }

  it('retourne 401 sans authentification', async () => {
    const id = await createClosedAccount();
    const res = await supertest(ctx.app).post(`/api/accounts/${id}/reopen`);
    expect(res.status).toBe(401);
  });

  it('retourne 404 si le compte est introuvable', async () => {
    const res = await ctx.agent.post('/api/accounts/99999/reopen');
    expect(res.status).toBe(404);
  });

  it("retourne 400 si le compte n'est pas clôturé", async () => {
    const create = await ctx.agent.post('/api/accounts').send({
      name: 'Actif',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2024-01-01',
    });
    const res = await ctx.agent.post(`/api/accounts/${create.body.id}/reopen`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pas clôturé/i);
  });

  it('rouvre le compte et supprime closed_at', async () => {
    const id = await createClosedAccount();
    const res = await ctx.agent.post(`/api/accounts/${id}/reopen`);
    expect(res.status).toBe(200);
    expect(res.body.closed_at).toBeNull();
  });

  it('le compte réouvert réapparaît actif dans GET /accounts', async () => {
    const id = await createClosedAccount();
    await ctx.agent.post(`/api/accounts/${id}/reopen`);

    const list = await ctx.agent.get('/api/accounts');
    const account = list.body.find((a: { id: number }) => a.id === id);
    expect(account.closed_at).toBeNull();
  });
});
