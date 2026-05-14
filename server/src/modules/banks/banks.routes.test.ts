import { beforeAll, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';

describe('/api/banks', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  it('GET / retourne un tableau de banques', async () => {
    const res = await ctx.agent.get('/api/banks');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST / crée une banque', async () => {
    const res = await ctx.agent.post('/api/banks').send({ name: 'TestBank' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('TestBank');
    expect(res.body.logo).toBeNull();
  });

  it('POST / retourne 400 si le nom est manquant', async () => {
    const res = await ctx.agent.post('/api/banks').send({});
    expect(res.status).toBe(400);
  });

  it('PUT /:id met à jour le nom de la banque', async () => {
    const create = await ctx.agent.post('/api/banks').send({ name: 'OldBank' });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/banks/${id}`).send({ name: 'NewBank' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('NewBank');
  });

  it('PUT /:id retourne 404 pour une banque inconnue', async () => {
    const res = await ctx.agent.put('/api/banks/99999').send({ name: 'x' });
    expect(res.status).toBe(404);
  });

  it("POST /:id/logo retourne 400 si aucun fichier n'est envoyé", async () => {
    const create = await ctx.agent.post('/api/banks').send({ name: 'LogoBank' });
    const id = create.body.id;
    const res = await ctx.agent.post(`/api/banks/${id}/logo`);
    expect(res.status).toBe(400);
  });

  it('DELETE /:id supprime une banque', async () => {
    const create = await ctx.agent.post('/api/banks').send({ name: 'ToDeleteBank' });
    const res = await ctx.agent.delete(`/api/banks/${create.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('DELETE /:id retourne 404 pour une banque inconnue', async () => {
    expect((await ctx.agent.delete('/api/banks/99999')).status).toBe(404);
  });
});
