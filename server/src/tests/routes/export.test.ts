import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { createTestContext, type TestContext } from '../helpers/testApp.js';
import { SEED } from '../helpers/testDb.js';

const TODAY = new Date().toISOString().split('T')[0];

describe('/api/export', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    const acc = await ctx.agent.post('/api/accounts').send({
      name: 'Main', bank_id: SEED.BANK_ID, account_type_id: SEED.AT_COURANT, opening_date: '2020-01-01',
    });
    const accountId = acc.body.id;
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId, type: 'income', amount: 2000,
      description: 'Salaire', category_id: SEED.CAT_SALAIRE, date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId, type: 'expense', amount: 50,
      description: 'Courses', category_id: SEED.CAT_ALIMENTATION, date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
  });

  describe('GET /csv', () => {
    it('returns 401 without auth', async () => {
      expect((await supertest(ctx.app).get('/api/export/csv')).status).toBe(401);
    });

    it('returns a CSV file with correct content-type', async () => {
      const res = await ctx.agent.get('/api/export/csv');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
    });

    it('CSV contains a header row', async () => {
      const res = await ctx.agent.get('/api/export/csv');
      const lines = res.text.split('\n');
      expect(lines[0]).toContain('Date');
      expect(lines[0]).toContain('Montant');
    });

    it('CSV has correct number of data rows', async () => {
      const res = await ctx.agent.get('/api/export/csv');
      const lines = res.text.replace(/^﻿/, '').split('\n').filter(Boolean);
      expect(lines.length).toBe(3); // header + 2 transactions
    });

    it('expense amounts are negative in CSV', async () => {
      const res = await ctx.agent.get('/api/export/csv');
      const lines = res.text.split('\n');
      const expenseLine = lines.find(l => l.includes('Courses'));
      expect(expenseLine).toContain('-50.00');
    });
  });

  describe('GET /json', () => {
    it('returns a JSON backup with correct structure', async () => {
      const res = await ctx.agent.get('/api/export/json');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('exported_at');
      expect(Array.isArray(res.body.accounts)).toBe(true);
      expect(Array.isArray(res.body.transactions)).toBe(true);
    });

    it('JSON contains the expected transactions', async () => {
      const res = await ctx.agent.get('/api/export/json');
      expect(res.body.transactions.length).toBe(2);
      expect(res.body.accounts.length).toBe(1);
    });
  });
});
