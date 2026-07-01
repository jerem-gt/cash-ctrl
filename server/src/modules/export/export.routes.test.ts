import supertest from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

const TODAY = new Date().toISOString().split('T')[0];

describe('/api/export', () => {
  let ctx: TestContext;
  let accountId: number;

  beforeAll(async () => {
    ctx = await createTestContext();
    const acc = await ctx.agent.post('/api/accounts').send({
      name: 'Main',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2020-01-01',
    });
    accountId = acc.body.id;
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'income',
      amount: 2000,
      description: 'Salaire',
      subcategory_id: SEED.SUBCAT_SALAIRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 50,
      description: 'Courses',
      subcategory_id: SEED.SUBCAT_SUPERMARCHE,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
  });

  describe('GET /json-full', () => {
    it('retourne 401 sans authentification', async () => {
      expect((await supertest(ctx.app).get('/api/export/json-full')).status).toBe(401);
    });

    it('retourne un JSON avec la structure complète', async () => {
      const res = await ctx.agent.get('/api/export/json-full');
      expect(res.status).toBe(200);
      expect(res.body.version).toBe('1.0');
      expect(res.body.amounts_in_cents).toBe(true);
      expect(Array.isArray(res.body.accounts)).toBe(true);
      expect(Array.isArray(res.body.transactions)).toBe(true);
      expect(Array.isArray(res.body.categories)).toBe(true);
      expect(Array.isArray(res.body.payment_methods)).toBe(true);
      expect(Array.isArray(res.body.scheduled_transactions)).toBe(true);
      expect(Array.isArray(res.body.stock_positions)).toBe(true);
      expect(Array.isArray(res.body.loans)).toBe(true);
    });

    it('contient les transactions avec les montants en centimes', async () => {
      const res = await ctx.agent.get('/api/export/json-full');
      expect(res.body.transactions).toHaveLength(2);
      const income = res.body.transactions.find((t: { type: string }) => t.type === 'income');
      expect(income.amount).toBe(200000);
    });

    it('filtre par accountIds', async () => {
      const res = await ctx.agent.get(`/api/export/json-full?accountIds=${accountId}`);
      expect(res.status).toBe(200);
      expect(res.body.accounts).toHaveLength(1);
      expect(res.body.accounts[0].id).toBe(accountId);
      expect(res.body.transactions).toHaveLength(2);
    });

    it('retourne un tableau vide si accountIds ne correspond à aucun compte', async () => {
      const res = await ctx.agent.get('/api/export/json-full?accountIds=999999');
      expect(res.status).toBe(200);
      expect(res.body.accounts).toHaveLength(0);
      expect(res.body.transactions).toHaveLength(0);
    });

    it('les transactions contiennent un tableau splits', async () => {
      const res = await ctx.agent.get('/api/export/json-full');
      for (const tx of res.body.transactions) {
        expect(Array.isArray(tx.splits)).toBe(true);
      }
    });

    it('retourne le header Content-Disposition correct', async () => {
      const res = await ctx.agent.get('/api/export/json-full');
      expect(res.headers['content-disposition']).toMatch(/cashctrl-full-/);
    });
  });
});
