import { beforeAll, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';

describe('/api/tax', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  describe('GET /years', () => {
    it('retourne la liste des années disponibles', async () => {
      const res = await ctx.agent.get('/api/tax/years');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toContain(2024);
      expect(res.body).toContain(2025);
    });

    it('retourne les années en ordre décroissant', async () => {
      const res = await ctx.agent.get('/api/tax/years');
      expect(res.status).toBe(200);
      const years: number[] = res.body;
      for (let i = 1; i < years.length; i++) {
        expect(years[i]).toBeLessThan(years[i - 1]);
      }
    });

    it('retourne 401 sans authentification', async () => {
      const { default: supertest } = await import('supertest');
      const unauthAgent = supertest(ctx.app);
      const res = await unauthAgent.get('/api/tax/years');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /:year', () => {
    it('retourne les données fiscales pour 2024', async () => {
      const res = await ctx.agent.get('/api/tax/2024');
      expect(res.status).toBe(200);
      expect(res.body.year).toBe(2024);
      expect(res.body.params).toBeDefined();
      expect(res.body.brackets).toBeDefined();
    });

    it('retourne 5 tranches pour 2024', async () => {
      const res = await ctx.agent.get('/api/tax/2024');
      expect(res.status).toBe(200);
      expect(res.body.brackets).toHaveLength(5);
    });

    it('retourne les bonnes bornes de tranches pour 2024', async () => {
      const res = await ctx.agent.get('/api/tax/2024');
      const brackets = res.body.brackets;
      expect(brackets[0]).toMatchObject({ min_income: 0, max_income: 11294, rate: 0 });
      expect(brackets[1]).toMatchObject({ min_income: 11294, max_income: 28797, rate: 11 });
      expect(brackets[2]).toMatchObject({ min_income: 28797, max_income: 82341, rate: 30 });
      expect(brackets[3]).toMatchObject({ min_income: 82341, max_income: 177106, rate: 41 });
      expect(brackets[4]).toMatchObject({ min_income: 177106, max_income: null, rate: 45 });
    });

    it("retourne les paramètres d'abattement pour 2024", async () => {
      const res = await ctx.agent.get('/api/tax/2024');
      const params = res.body.params;
      expect(params.abattement_rate).toBe(0.1);
      expect(params.abattement_min).toBe(448);
      expect(params.abattement_max).toBe(13522);
      expect(params.pass).toBe(46368);
    });

    it('retourne les données fiscales pour 2025', async () => {
      const res = await ctx.agent.get('/api/tax/2025');
      expect(res.status).toBe(200);
      expect(res.body.year).toBe(2025);
      expect(res.body.brackets[0]).toMatchObject({ min_income: 0, max_income: 11497, rate: 0 });
    });

    it('retourne 404 pour une année sans barème', async () => {
      const res = await ctx.agent.get('/api/tax/1999');
      expect(res.status).toBe(404);
    });

    it('retourne 400 pour une année non numérique', async () => {
      const res = await ctx.agent.get('/api/tax/abc');
      expect(res.status).toBe(400);
    });

    it('retourne 401 sans authentification', async () => {
      const { default: supertest } = await import('supertest');
      const unauthAgent = supertest(ctx.app);
      const res = await unauthAgent.get('/api/tax/2024');
      expect(res.status).toBe(401);
    });
  });
});
