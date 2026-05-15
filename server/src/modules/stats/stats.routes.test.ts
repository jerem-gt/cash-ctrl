import { beforeEach, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

const TODAY = new Date().toISOString().split('T')[0];
const CURRENT_YEAR = new Date().getUTCFullYear().toString();

describe('/api/stats', () => {
  let ctx: TestContext;
  let accountId: number;
  let bourseAccountId: number;

  // On recrée TOUT le contexte avant chaque "it" pour une isolation totale
  beforeEach(async () => {
    ctx = await createTestContext();

    // Setup Compte Courant
    const acc = await ctx.agent.post('/api/accounts').send({
      name: 'Courant',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2020-01-01',
      initial_balance: 10, // 10€
    });
    accountId = acc.body.id;

    // Setup Compte Bourse
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

  describe('getBalanceHistory avec Stocks', () => {
    it('devrait répartir cash non investi en Liquidités et book value en Actions & UC', async () => {
      // Dépôt 1000€ puis achat 500€ => cash restant 500€, book value 500€
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

      const res = await ctx.agent.get('/api/stats/balance-history');
      const yearData = res.body.data.find((d: { year: string }) => d.year === CURRENT_YEAR);

      // Liquidités = Courant initial (10) + Bourse cash non investi (500) = 510
      expect(yearData['Liquidités']).toBe(510);
      // Actions & UC = book value de l'achat (10 x 50)
      expect(yearData['Actions & UC']).toBe(500);
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

      // Liquidités = Courant initial (10) + Bourse cash (-100 achat + 150 vente = 50) = 60
      expect(yearData['Liquidités']).toBe(60);
      expect(yearData['Actions & UC']).toBe(0);
    });
  });
});
