import supertest from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb';

describe('/api/subcategories', () => {
  let ctx: TestContext;
  let categoryId: number;

  beforeAll(async () => {
    ctx = await createTestContext();

    // Création d'une catégorie parente pour les tests de sous-catégories
    const catRes = await ctx.agent
      .post('/api/categories')
      .send({ name: 'Catégorie Parent', color: '#123456', icon: '❓' });
    categoryId = catRes.body.id;
  });

  it('GET / returns 401 without auth', async () => {
    expect((await supertest(ctx.app).get('/api/subcategories')).status).toBe(401);
  });

  it('GET / returns array of subcategories', async () => {
    const res = await ctx.agent.get('/api/subcategories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST / creates a subcategory', async () => {
    const res = await ctx.agent
      .post('/api/subcategories')
      .send({ category_id: categoryId, name: 'Courses' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Courses');
    expect(res.body.category_id).toBe(categoryId);
  });

  it('POST / returns 404 if parent category does not exist', async () => {
    const res = await ctx.agent
      .post('/api/subcategories')
      .send({ category_id: 99999, name: 'Invalide' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Catégorie introuvable');
  });

  it('POST / returns 400 when name is missing or too long', async () => {
    const res = await ctx.agent
      .post('/api/subcategories')
      .send({ category_id: categoryId, name: '' });

    expect(res.status).toBe(400);
  });

  it('PUT /:id updates a subcategory name', async () => {
    const create = await ctx.agent
      .post('/api/subcategories')
      .send({ category_id: categoryId, name: 'Original' });

    const id = create.body.id;
    const res = await ctx.agent.put(`/api/subcategories/${id}`).send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
  });

  it('PUT /:id returns 404 for unknown subcategory', async () => {
    const res = await ctx.agent.put('/api/subcategories/99999').send({ name: 'Nulle part' });

    expect(res.status).toBe(404);
  });

  it('DELETE /:id removes a subcategory', async () => {
    const create = await ctx.agent
      .post('/api/subcategories')
      .send({ category_id: categoryId, name: 'To Delete' });

    const id = create.body.id;
    const res = await ctx.agent.delete(`/api/subcategories/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('DELETE /:id returns 409 if subcategory has transactions', async () => {
    // 1. Créer une sous-catégorie propre pour ce test
    const subRes = await ctx.agent
      .post('/api/subcategories')
      .send({ category_id: categoryId, name: 'With Transactions' });
    const subId = subRes.body.id;

    // 2. Créer une transaction liée à cette sous-catégorie
    const acc = await ctx.agent.post('/api/accounts').send({
      name: 'Main',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2020-01-01',
    });
    const accountId = acc.body.id;
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 2000,
      description: 'Achat test',
      subcategory_id: subId,
      date: '2024-03-20',
      payment_method_id: SEED.PM_VIREMENT,
    });

    // 3. Tenter de supprimer la sous-catégorie
    const res = await ctx.agent.delete(`/api/subcategories/${subId}`);

    // 4. Vérifier que le serveur bloque la suppression
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Cette sous-catégorie est utilisée/);
  });
});
