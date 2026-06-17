import supertest from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

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

  it('GET /match retourne null si description absente', async () => {
    const res = await ctx.agent.get('/api/categorization-rules/match');
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

describe('/api/categorization-rules — initFromHistory avec données réelles', () => {
  let ctx2: TestContext;
  let accountId: number;
  let subcatId: number;

  const TODAY = new Date().toISOString().split('T')[0];

  beforeAll(async () => {
    ctx2 = await createTestContext();

    const acc = await ctx2.agent.post('/api/accounts').send({
      name: 'HistAcc',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2020-01-01',
    });
    accountId = acc.body.id as number;

    const cat = await ctx2.agent.post('/api/categories').send({ name: 'HistCat', icon: '📊' });
    const sub = await ctx2.agent
      .post('/api/subcategories')
      .send({ name: 'HistSub', category_id: cat.body.id });
    subcatId = sub.body.id as number;
  });

  afterEach(async () => {
    await ctx2.agent.delete('/api/categorization-rules');
  });

  async function createTxPair(description: string, subcategoryId = subcatId) {
    const body = {
      account_id: accountId,
      type: 'expense',
      amount: 500,
      subcategory_id: subcategoryId,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
      description,
    };
    await ctx2.agent.post('/api/transactions').send(body);
    await ctx2.agent.post('/api/transactions').send(body);
  }

  it('génère un pattern commun si les descriptions partagent un préfixe ≥ 3 chars', async () => {
    await createTxPair('anniv paul');
    await createTxPair('anniv marie');

    const res = await ctx2.agent.post('/api/categorization-rules/init-from-history');
    expect(res.status).toBe(201);
    expect(res.body.inserted).toBeGreaterThan(0);

    const rules = await ctx2.agent.get('/api/categorization-rules');
    expect((rules.body as Array<{ pattern: string }>).some((r) => r.pattern === '%anniv%')).toBe(
      true,
    );
  });

  it("génère des patterns individuels si les descriptions n'ont pas de préfixe commun", async () => {
    const cat2 = await ctx2.agent.post('/api/categories').send({ name: 'NoPfxCat', icon: '📊' });
    const sub2 = await ctx2.agent
      .post('/api/subcategories')
      .send({ name: 'NoPfxSub', category_id: cat2.body.id });
    const subcatId2 = sub2.body.id as number;

    await createTxPair('cinema ufc', subcatId2);
    await createTxPair('boulangerie dupont', subcatId2);

    const res = await ctx2.agent.post('/api/categorization-rules/init-from-history');
    expect(res.status).toBe(201);

    const rules = await ctx2.agent.get('/api/categorization-rules');
    const patterns = (rules.body as Array<{ pattern: string }>).map((r) => r.pattern);
    expect(patterns.some((p) => p.includes('cinema ufc'))).toBe(true);
    expect(patterns.some((p) => p.includes('boulangerie dupont'))).toBe(true);
    expect(patterns.every((p) => !p.includes('%cinema%') || p === '%cinema ufc%')).toBe(true);
  });

  it('ne duplique pas un pattern déjà existant', async () => {
    await createTxPair('duptest');

    await ctx2.agent.post('/api/categorization-rules/init-from-history');
    const res = await ctx2.agent.post('/api/categorization-rules/init-from-history');
    expect(res.status).toBe(201);
    expect(res.body.inserted).toBe(0);
  });

  it("ignore les descriptions n'apparaissant qu'une seule fois", async () => {
    await ctx2.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 500,
      subcategory_id: subcatId,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
      description: 'singleoccurrence',
    });
    await createTxPair('pairoccurrence');

    const res = await ctx2.agent.post('/api/categorization-rules/init-from-history');
    expect(res.status).toBe(201);

    const rules = await ctx2.agent.get('/api/categorization-rules');
    const patterns = (rules.body as Array<{ pattern: string }>).map((r) => r.pattern);
    expect(patterns.some((p) => p.includes('singleoccurrence'))).toBe(false);
    expect(patterns.some((p) => p.includes('pairoccurrence'))).toBe(true);
  });
});
