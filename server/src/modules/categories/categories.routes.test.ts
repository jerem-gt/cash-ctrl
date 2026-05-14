import supertest from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';

describe('/api/categories', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  it('GET / retourne 401 sans authentification', async () => {
    expect((await supertest(ctx.app).get('/api/categories')).status).toBe(401);
  });

  it('GET / retourne un tableau de catégories', async () => {
    const res = await ctx.agent.get('/api/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST / crée une catégorie', async () => {
    const res = await ctx.agent.post('/api/categories').send({ name: 'Vacances', icon: '❓' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Vacances');
  });

  it('POST / retourne 400 si le nom est manquant', async () => {
    const res = await ctx.agent.post('/api/categories').send({ icon: '❓' });
    expect(res.status).toBe(400);
  });

  it('PUT /:id met à jour une catégorie', async () => {
    const create = await ctx.agent.post('/api/categories').send({ name: 'ToUpdate', icon: '❓' });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/categories/${id}`).send({ name: 'Updated', icon: '❓' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
  });

  it('PUT /:id retourne 404 pour une catégorie inconnue', async () => {
    const res = await ctx.agent.put('/api/categories/99999').send({ name: 'x', icon: '❓' });
    expect(res.status).toBe(404);
  });

  it('DELETE /:id supprime une catégorie', async () => {
    const create = await ctx.agent.post('/api/categories').send({ name: 'ToDelete', icon: '❓' });
    const id = create.body.id;
    const res = await ctx.agent.delete(`/api/categories/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('DELETE /:id retourne 404 pour une catégorie inconnue', async () => {
    expect((await ctx.agent.delete('/api/categories/99999')).status).toBe(404);
  });
});
