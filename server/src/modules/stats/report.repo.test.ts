import { beforeEach, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

const TODAY = new Date().toISOString().split('T')[0];
const CURRENT_YEAR = new Date().getUTCFullYear().toString();
const CURRENT_YEAR_NUM = new Date().getUTCFullYear();

describe('getReportYears (/api/stats/report-years)', () => {
  let ctx: TestContext;
  let accountId: number;

  beforeEach(async () => {
    ctx = await createTestContext();
    const acc = await ctx.agent.post('/api/accounts').send({
      name: 'Courant',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2020-01-01',
      initial_balance: 10,
    });
    accountId = acc.body.id;
  });

  it('retourne [] quand aucune transaction validée', async () => {
    const res = await ctx.agent.get('/api/stats/report-years');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('retourne les années avec transactions validées, triées décroissantes', async () => {
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'income',
      amount: 100,
      description: 'S',
      subcategory_id: SEED.SUBCAT_SALAIRE,
      date: '2023-06-01',
      payment_method_id: SEED.PM_VIREMENT,
      validated: true,
    });
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 50,
      description: 'D',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
      validated: true,
    });
    const res = await ctx.agent.get('/api/stats/report-years');
    expect(res.body).toContain(2023);
    expect(res.body).toContain(CURRENT_YEAR_NUM);
    expect(res.body.indexOf(CURRENT_YEAR_NUM)).toBeLessThan(res.body.indexOf(2023));
  });

  it("n'inclut pas les années avec uniquement des transactions non validées", async () => {
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'income',
      amount: 100,
      description: 'Non validée',
      subcategory_id: SEED.SUBCAT_SALAIRE,
      date: '2020-01-15',
      payment_method_id: SEED.PM_VIREMENT,
      validated: false,
    });
    const res = await ctx.agent.get('/api/stats/report-years');
    expect(res.body).not.toContain(2020);
  });
});

describe('getReport (/api/stats/report)', () => {
  let ctx: TestContext;
  let accountId: number;

  beforeEach(async () => {
    ctx = await createTestContext();
    const acc = await ctx.agent.post('/api/accounts').send({
      name: 'Courant',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2020-01-01',
      initial_balance: 10,
    });
    accountId = acc.body.id;
  });

  it('retourne 400 si year est invalide', async () => {
    const res = await ctx.agent.get('/api/stats/report?year=abc');
    expect(res.status).toBe(400);
  });

  it('retourne des zéros et 12 mois quand aucune transaction', async () => {
    const res = await ctx.agent.get(`/api/stats/report?year=${CURRENT_YEAR_NUM}`);
    expect(res.status).toBe(200);
    expect(res.body.income_total).toBe(0);
    expect(res.body.expense_total).toBe(0);
    expect(res.body.monthly).toHaveLength(12);
    expect(res.body.expense_by_category).toHaveLength(0);
    expect(res.body.income_by_category).toHaveLength(0);
  });

  it('calcule les totaux et répartitions des transactions validées', async () => {
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'income',
      amount: 1000,
      description: 'Salaire',
      subcategory_id: SEED.SUBCAT_SALAIRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
      validated: true,
    });
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 300,
      description: 'Courses',
      subcategory_id: SEED.SUBCAT_SUPERMARCHE,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
      validated: true,
    });
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 500,
      description: 'Non validée',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
      validated: false,
    });
    const res = await ctx.agent.get(`/api/stats/report?year=${CURRENT_YEAR_NUM}`);
    expect(res.body.income_total).toBe(1000);
    expect(res.body.expense_total).toBe(300);
    expect(res.body.income_by_category).toHaveLength(1);
    expect(res.body.expense_by_category).toHaveLength(1);
  });

  it('exclut les virements inter-comptes', async () => {
    const other = await ctx.agent.post('/api/accounts').send({
      name: 'Épargne',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_EPARGNE,
      initial_balance: 0,
      opening_date: TODAY,
    });
    await ctx.agent.post('/api/transfers').send({
      from_account_id: accountId,
      to_account_id: other.body.id,
      amount: 500,
      date: TODAY,
      description: 'Virement',
      validated: true,
    });
    const res = await ctx.agent.get(`/api/stats/report?year=${CURRENT_YEAR_NUM}`);
    expect(res.body.income_total).toBe(0);
    expect(res.body.expense_total).toBe(0);
  });

  it('exclut les achats de titres mais inclut les frais de courtage', async () => {
    const bourse = await ctx.agent.post('/api/accounts').send({
      name: 'PEA',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_BOURSE,
      opening_date: '2020-01-01',
      initial_balance: 0,
    });
    await ctx.agent.post(`/api/stocks/${bourse.body.id}/buy`).send({
      ticker: 'ETF1',
      quantity: 5,
      price_per_share: 100,
      fees: 10,
      date: TODAY,
    });
    const res = await ctx.agent.get(`/api/stats/report?year=${CURRENT_YEAR_NUM}`);
    // Achat (500€) exclu, frais (10€) comptés comme dépense
    expect(res.body.expense_total).toBe(10);
  });

  it('filtre par account_id', async () => {
    const other = await ctx.agent.post('/api/accounts').send({
      name: 'Autre',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      initial_balance: 0,
      opening_date: TODAY,
    });
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'income',
      amount: 1000,
      description: 'A',
      subcategory_id: SEED.SUBCAT_SALAIRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
      validated: true,
    });
    await ctx.agent.post('/api/transactions').send({
      account_id: other.body.id,
      type: 'income',
      amount: 500,
      description: 'B',
      subcategory_id: SEED.SUBCAT_SALAIRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
      validated: true,
    });
    const res = await ctx.agent.get(
      `/api/stats/report?year=${CURRENT_YEAR_NUM}&account_id=${accountId}`,
    );
    expect(res.body.income_total).toBe(1000);
  });

  it('répartit correctement les transactions dans le bon mois', async () => {
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 200,
      description: 'Janv',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: `${CURRENT_YEAR}-01-15`,
      payment_method_id: SEED.PM_CARTE,
      validated: true,
    });
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 150,
      description: 'Mars',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: `${CURRENT_YEAR}-03-10`,
      payment_method_id: SEED.PM_CARTE,
      validated: true,
    });
    const res = await ctx.agent.get(`/api/stats/report?year=${CURRENT_YEAR_NUM}`);
    const jan = res.body.monthly.find((m: { month: string }) => m.month.endsWith('-01'));
    const mar = res.body.monthly.find((m: { month: string }) => m.month.endsWith('-03'));
    expect(jan.expense).toBe(200);
    expect(mar.expense).toBe(150);
  });
});
