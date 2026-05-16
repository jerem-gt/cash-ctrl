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

  describe('PUT /reorder', () => {
    it("réordonne les banques et persiste l'ordre", async () => {
      const b1 = (await ctx.agent.post('/api/banks').send({ name: 'Banque A' })).body;
      const b2 = (await ctx.agent.post('/api/banks').send({ name: 'Banque B' })).body;

      const res = await ctx.agent.put('/api/banks/reorder').send([
        { id: b2.id, sort_order: 0 },
        { id: b1.id, sort_order: 1 },
      ]);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const list = (await ctx.agent.get('/api/banks')).body as { id: number }[];
      const ids = list.map((b) => b.id);
      expect(ids.indexOf(b2.id)).toBeLessThan(ids.indexOf(b1.id));
    });

    it("retourne 400 si le body n'est pas un tableau valide", async () => {
      const res = await ctx.agent.put('/api/banks/reorder').send({ id: 1 });
      expect(res.status).toBe(400);
    });

    it('retourne 400 si un élément est malformé', async () => {
      const res = await ctx.agent.put('/api/banks/reorder').send([{ id: 'abc', sort_order: 0 }]);
      expect(res.status).toBe(400);
    });
  });

  it('POST / crée une banque avec un sort_order défini', async () => {
    const res = await ctx.agent.post('/api/banks').send({ name: 'NewOrderBank' });
    expect(res.status).toBe(201);
    expect(typeof res.body.sort_order).toBe('number');
  });
});
