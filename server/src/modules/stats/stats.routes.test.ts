import { beforeEach, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

const TODAY = new Date().toISOString().split('T')[0];
const CURRENT_YEAR = new Date().getUTCFullYear().toString();

describe('/api/stats — dashboard & balance history', () => {
  let ctx: TestContext;
  let accountId: number;
  let bourseAccountId: number;

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

    const bourse = await ctx.agent.post('/api/accounts').send({
      name: 'PEA',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_BOURSE,
      opening_date: '2020-01-01',
      initial_balance: 0,
    });
    bourseAccountId = bourse.body.id;
  });

  describe('getDashboardStats', () => {
    it('devrait calculer uniquement les transactions validées du mois', async () => {
      // 1. Un revenu validé (100€)
      await ctx.agent.post('/api/transactions').send({
        account_id: accountId,
        type: 'income',
        amount: 100,
        description: 'Salaire',
        subcategory_id: SEED.SUBCAT_SALAIRE,
        date: TODAY,
        payment_method_id: SEED.PM_VIREMENT,
        validated: true,
      });

      // 2. Une dépense NON validée (50€) -> ne doit pas impacter month_expense
      await ctx.agent.post('/api/transactions').send({
        account_id: accountId,
        type: 'expense',
        amount: 50,
        description: 'Cadeau non validé',
        subcategory_id: SEED.SUBCAT_AUTRE,
        date: TODAY,
        payment_method_id: SEED.PM_CARTE,
        validated: false,
      });

      const res = await ctx.agent.get('/api/stats');

      expect(res.body.month_income).toBe(100);
      expect(res.body.month_expense).toBe(0); // Car la dépense n'est pas validée
      expect(res.body.to_validate).toHaveLength(1);
      expect(res.body.to_validate[0].description).toBe('Cadeau non validé');
    });
  });

  it("getBalanceHistory : retourne vide quand l'utilisateur n'a aucun compte", async () => {
    const freshCtx = await createTestContext();
    const res = await freshCtx.agent.get('/api/stats/balance-history');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ account_types: [], data: [] });
  });

  describe('getBalanceHistory catégories Épargne, AV/PER, Prêt', () => {
    let ctx2: TestContext;

    beforeEach(async () => {
      ctx2 = await createTestContext();
    });

    it('devrait répartir un compte Épargne dans la catégorie Épargne', async () => {
      const epargne = await ctx2.agent.post('/api/accounts').send({
        name: 'Livret A',
        bank_id: SEED.BANK_ID,
        account_type_id: SEED.AT_EPARGNE,
        opening_date: '2022-01-01',
        initial_balance: 500,
      });
      await ctx2.agent.post('/api/transactions').send({
        account_id: epargne.body.id,
        type: 'income',
        amount: 200,
        description: 'Intérêts',
        subcategory_id: SEED.SUBCAT_AUTRE,
        date: TODAY,
        payment_method_id: SEED.PM_VIREMENT,
        validated: true,
      });
      const res = await ctx2.agent.get('/api/stats/balance-history');
      const yearData = res.body.data.find((d: { year: string }) => d.year === CURRENT_YEAR);
      expect(yearData['epargne']).toBe(700);
    });

    it('devrait comptabiliser les versements AV euro et UC dans Fonds euros et Actions & UC', async () => {
      const av = await ctx2.agent.post('/api/accounts').send({
        name: 'AV Test',
        bank_id: SEED.BANK_ID,
        account_type_id: SEED.AT_AV,
        opening_date: '2022-01-01',
        initial_balance: 0,
      });
      const avId = av.body.id;

      const euroSup = await ctx2.agent.post(`/api/insurance/${avId}/supports`).send({
        account_id: avId,
        name: 'Fonds Euro',
        type: 'euro',
      });
      await ctx2.agent.post(`/api/insurance/${avId}/versement`).send({
        account_id: avId,
        support_id: euroSup.body.id,
        amount: 1000,
        fees: 0,
        date: TODAY,
      });

      const ucSup = await ctx2.agent.post(`/api/insurance/${avId}/supports`).send({
        account_id: avId,
        name: 'UC World',
        type: 'uc',
      });
      await ctx2.agent.post(`/api/insurance/${avId}/versement`).send({
        account_id: avId,
        support_id: ucSup.body.id,
        amount: 500,
        fees: 0,
        date: TODAY,
      });

      const res = await ctx2.agent.get('/api/stats/balance-history');
      const yearData = res.body.data.find((d: { year: string }) => d.year === CURRENT_YEAR);
      expect(yearData['fonds_euros']).toBe(1000);
      expect(yearData['actions_uc']).toBe(500);
    });

    it("devrait refléter la dette d'un prêt dans la catégorie Prêts", async () => {
      ctx2.db
        .prepare(
          "INSERT INTO account_types (user_id, name, envelope_type) VALUES (?, 'Prêt', 'loan')",
        )
        .run(ctx2.userId);

      const src = await ctx2.agent.post('/api/accounts').send({
        name: 'Source',
        bank_id: SEED.BANK_ID,
        account_type_id: SEED.AT_COURANT,
        initial_balance: 100000,
        opening_date: '2024-01-01',
      });
      const dep = await ctx2.agent.post('/api/accounts').send({
        name: 'Dépôt',
        bank_id: SEED.BANK_ID,
        account_type_id: SEED.AT_COURANT,
        initial_balance: 0,
        opening_date: '2024-01-01',
      });
      const loanRes = await ctx2.agent.post('/api/loans').send({
        name: 'Prêt immo test',
        bank_id: SEED.BANK_ID,
        opening_date: '2024-01-01',
        principal_amount: 12000,
        interest_rate: 0,
        duration_months: 12,
        start_date: '2024-02-01',
        source_account_id: src.body.id,
        deposit_account_id: dep.body.id,
      });
      expect(loanRes.status).toBe(201);

      const res = await ctx2.agent.get('/api/stats/balance-history');
      const yearData = res.body.data.find((d: { year: string }) => d.year === CURRENT_YEAR);
      expect(yearData['prets']).toBe(-12000);
    });
  });

  describe('getBalanceHistory avec Stocks', () => {
    it('devrait répartir cash Bourse et valeur de marché en Actions & UC', async () => {
      // Dépôt 1000€ puis achat 500€ => cash restant 500€, 10 AAPL à PRU 50
      await ctx.agent.post('/api/transactions').send({
        account_id: bourseAccountId,
        type: 'income',
        amount: 1000,
        description: 'Dépôt',
        subcategory_id: SEED.SUBCAT_SALAIRE,
        date: '2023-01-01',
        payment_method_id: SEED.PM_VIREMENT,
        validated: true,
      });

      await ctx.agent.post(`/api/stocks/${bourseAccountId}/buy`).send({
        ticker: 'AAPL',
        quantity: 10,
        price_per_share: 50,
        fees: 0,
        date: TODAY,
      });

      // Cours de marché actuel : 60€/action => valeur de marché = 600€
      ctx.db
        .prepare(
          `INSERT OR REPLACE INTO stock_prices (ticker, price, currency, name, fetched_at)
           VALUES ('AAPL', 60, 'EUR', 'Apple Inc.', ?)`,
        )
        .run(TODAY);

      const res = await ctx.agent.get('/api/stats/balance-history');
      const yearData = res.body.data.find((d: { year: string }) => d.year === CURRENT_YEAR);

      // Liquidités = Courant initial (10) + Bourse cash non investi (500)
      expect(yearData['liquidites']).toBe(510);
      // Actions & UC = valeur de marché des positions uniquement (10 x 60)
      expect(yearData['actions_uc']).toBe(600);
    });

    it('devrait refléter une vente avec plus-value dans Liquidités', async () => {
      // Achat book value 100€, vente à 150€ => cash net +50€, plus de positions
      await ctx.agent.post(`/api/stocks/${bourseAccountId}/buy`).send({
        ticker: 'MSFT',
        quantity: 1,
        price_per_share: 100,
        fees: 0,
        date: '2023-01-01',
      });

      await ctx.agent.post(`/api/stocks/${bourseAccountId}/sell`).send({
        ticker: 'MSFT',
        quantity: 1,
        price_per_share: 150,
        fees: 0,
        date: TODAY,
      });

      const res = await ctx.agent.get('/api/stats/balance-history');
      const yearData = res.body.data.find((d: { year: string }) => d.year === CURRENT_YEAR);

      // Liquidités = Courant initial (10) + Bourse cash net (-100 achat + 150 vente = 50)
      expect(yearData['liquidites']).toBe(60);
      // Actions & UC = valeur de marché des positions uniquement (aucune position)
      expect(yearData['actions_uc']).toBe(0);
    });
  });
});
