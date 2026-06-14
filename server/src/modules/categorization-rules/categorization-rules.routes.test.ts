import supertest from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';

describe('/api/categorization-rules', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  it('GET / retourne 401 sans authentification', async () => {
    expect((await supertest(ctx.app).get('/api/categorization-rules')).status).toBe(401);
  });

  it('GET / retourne un tableau vide initialement', async () => {
    const res = await ctx.agent.get('/api/categorization-rules');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST / crée une règle', async () => {
    const sub = await ctx.agent.post('/api/categories').send({ name: 'TestCat', icon: '🧪' });
    const subRes = await ctx.agent
      .post('/api/subcategories')
      .send({ name: 'TestSub', category_id: sub.body.id });
    const res = await ctx.agent
      .post('/api/categorization-rules')
      .send({ pattern: '%leclerc%', subcategory_id: subRes.body.id });
    expect(res.status).toBe(201);
    expect(res.body.pattern).toBe('%leclerc%');
    expect(res.body.subcategory_id).toBe(subRes.body.id);
  });

  it('POST / retourne 400 si pattern manquant', async () => {
    const res = await ctx.agent.post('/api/categorization-rules').send({ subcategory_id: 1 });
    expect(res.status).toBe(400);
  });

  it('GET /match retourne la règle correspondante', async () => {
    const res = await ctx.agent.get('/api/categorization-rules/match?description=Courses+Leclerc');
    expect(res.status).toBe(200);
    expect(res.body).not.toBeNull();
    expect(res.body.pattern).toBe('%leclerc%');
  });

  it('GET /match retourne null si aucune règle ne correspond', async () => {
    const res = await ctx.agent.get('/api/categorization-rules/match?description=LOYER+JANVIER');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('GET /match retourne null si description vide', async () => {
    const res = await ctx.agent.get('/api/categorization-rules/match?description=');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('PUT /:id met à jour une règle', async () => {
    const list = await ctx.agent.get('/api/categorization-rules');
    const id = list.body[0].id;
    const res = await ctx.agent
      .put(`/api/categorization-rules/${id}`)
      .send({ pattern: '%carrefour%', subcategory_id: list.body[0].subcategory_id });
    expect(res.status).toBe(200);
    expect(res.body.pattern).toBe('%carrefour%');
  });

  it('PUT /:id retourne 404 pour une règle inconnue', async () => {
    const res = await ctx.agent
      .put('/api/categorization-rules/99999')
      .send({ pattern: '%x%', subcategory_id: 1 });
    expect(res.status).toBe(404);
  });

  it('DELETE /:id supprime une règle', async () => {
    const list = await ctx.agent.get('/api/categorization-rules');
    const id = list.body[0].id;
    expect((await ctx.agent.delete(`/api/categorization-rules/${id}`)).status).toBe(200);
  });

  it('DELETE /:id retourne 404 pour une règle inconnue', async () => {
    expect((await ctx.agent.delete('/api/categorization-rules/99999')).status).toBe(404);
  });

  it('POST /init-from-history retourne le nombre de règles insérées', async () => {
    const res = await ctx.agent.post('/api/categorization-rules/init-from-history');
    expect(res.status).toBe(201);
    expect(typeof res.body.inserted).toBe('number');
  });

  it('DELETE / supprime toutes les règles', async () => {
    // Créer une règle d'abord
    const sub = await ctx.agent.post('/api/categories').send({ name: 'CatDel', icon: '🗑' });
    const subRes = await ctx.agent
      .post('/api/subcategories')
      .send({ name: 'SubDel', category_id: sub.body.id });
    await ctx.agent
      .post('/api/categorization-rules')
      .send({ pattern: '%todelete%', subcategory_id: subRes.body.id });

    const res = await ctx.agent.delete('/api/categorization-rules');
    expect(res.status).toBe(200);
    expect(typeof res.body.deleted).toBe('number');
    expect(res.body.deleted).toBeGreaterThan(0);

    const list = await ctx.agent.get('/api/categorization-rules');
    expect(list.body).toHaveLength(0);
  });
});
