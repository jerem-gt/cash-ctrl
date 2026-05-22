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
      expect(yearData['Épargne']).toBe(700);
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
      expect(yearData['Fonds euros']).toBe(1000);
      expect(yearData['Actions & UC']).toBe(500);
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
      expect(yearData['Prêts']).toBe(-12000);
    });
  });

  describe('getProfitability', () => {
    it('retourne [] quand aucun compte éligible', async () => {
      const freshCtx = await createTestContext();
      const res = await freshCtx.agent.get('/api/stats/profitability');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('compte Bourse : capital investi = dépôt, valeur = cash + stocks', async () => {
      // Dépôt 1 000€ via virement (income avec transfer_peer_id)
      const courantAcc = await ctx.agent.post('/api/accounts').send({
        name: 'Courant2',
        bank_id: SEED.BANK_ID,
        account_type_id: SEED.AT_COURANT,
        opening_date: '2023-01-01',
        initial_balance: 0,
      });
      await ctx.agent.post('/api/transfers').send({
        from_account_id: courantAcc.body.id,
        to_account_id: bourseAccountId,
        amount: 1000,
        date: TODAY,
        description: 'Dépôt PEA',
        validated: true,
      });

      // Achat 5 actions à 100€ chacune, cours actuel 120€
      await ctx.agent.post(`/api/stocks/${bourseAccountId}/buy`).send({
        ticker: 'ETF1',
        quantity: 5,
        price_per_share: 100,
        fees: 0,
        date: TODAY,
      });
      ctx.db
        .prepare(
          `INSERT OR REPLACE INTO stock_prices (ticker, price, currency, name, fetched_at)
           VALUES ('ETF1', 120, 'EUR', 'ETF Test', ?)`,
        )
        .run(TODAY);

      const res = await ctx.agent.get('/api/stats/profitability');
      const pea = res.body.find((a: { account_id: number }) => a.account_id === bourseAccountId);

      expect(pea).toBeDefined();
      expect(pea.capital_investi).toBe(1000); // dépôt = 1 000€
      // valeur = cash(1000-500) + stocks(5×120) = 500 + 600 = 1100
      expect(pea.valeur_actuelle).toBeCloseTo(1100);
      expect(pea.plus_value_absolue).toBeCloseTo(100);
      expect(pea.rendement_total_pct).toBeCloseTo(10);
    });

    it('compte AV : versement + intérêts → plus-value = intérêts nets', async () => {
      const av = await ctx.agent.post('/api/accounts').send({
        name: 'AV Test',
        bank_id: SEED.BANK_ID,
        account_type_id: SEED.AT_AV,
        opening_date: '2023-01-01',
        initial_balance: 0,
      });
      const avId = av.body.id;
      const sup = await ctx.agent.post(`/api/insurance/${avId}/supports`).send({
        name: 'Fonds Euro',
        type: 'euro',
      });
      await ctx.agent.post(`/api/insurance/${avId}/versement`).send({
        support_id: sup.body.id,
        amount: 5000,
        fees: 0,
        date: TODAY,
      });
      await ctx.agent.post(`/api/insurance/${avId}/interets`).send({
        support_id: sup.body.id,
        amount: 150,
        fees: 0,
        social_fees: 0,
        date: TODAY,
      });

      const res = await ctx.agent.get('/api/stats/profitability');
      const acc = res.body.find((a: { account_id: number }) => a.account_id === avId);

      expect(acc).toBeDefined();
      expect(acc.capital_investi).toBe(5000);
      expect(acc.valeur_actuelle).toBeCloseTo(5150);
      expect(acc.plus_value_absolue).toBeCloseTo(150);
      expect(acc.rendement_total_pct).toBeCloseTo(3);
    });

    it('compte Épargne : virement pair + income sans pair → plus-value = intérêts implicites', async () => {
      const epargne = await ctx.agent.post('/api/accounts').send({
        name: 'Livret A',
        bank_id: SEED.BANK_ID,
        account_type_id: SEED.AT_EPARGNE,
        opening_date: '2023-01-01',
        initial_balance: 0,
      });
      const courant2 = await ctx.agent.post('/api/accounts').send({
        name: 'Courant3',
        bank_id: SEED.BANK_ID,
        account_type_id: SEED.AT_COURANT,
        opening_date: '2023-01-01',
        initial_balance: 0,
      });
      // Virement 1 000€ depuis courant (transfer_peer_id sera défini)
      await ctx.agent.post('/api/transfers').send({
        from_account_id: courant2.body.id,
        to_account_id: epargne.body.id,
        amount: 1000,
        date: TODAY,
        description: 'Virement épargne',
        validated: true,
      });
      // Intérêts 30€ sans pair (standalone income, catégorie Revenus financiers)
      await ctx.agent.post('/api/transactions').send({
        account_id: epargne.body.id,
        type: 'income',
        amount: 30,
        description: 'Intérêts',
        subcategory_id: SEED.SUBCAT_INTERETS,
        date: TODAY,
        payment_method_id: SEED.PM_VIREMENT,
        validated: true,
      });

      const res = await ctx.agent.get('/api/stats/profitability');
      const acc = res.body.find((a: { account_id: number }) => a.account_id === epargne.body.id);

      expect(acc).toBeDefined();
      expect(acc.capital_investi).toBe(1000);
      expect(acc.valeur_actuelle).toBeCloseTo(1030);
      expect(acc.plus_value_absolue).toBeCloseTo(30);
    });

    it('compte fermé exclu du résultat', async () => {
      await ctx.agent.post(`/api/accounts/${bourseAccountId}/close`).send({
        closed_at: TODAY,
      });
      const res = await ctx.agent.get('/api/stats/profitability');
      expect(
        res.body.find((a: { account_id: number }) => a.account_id === bourseAccountId),
      ).toBeUndefined();
    });

    it("yearly_returns : reconstruction correcte du solde de début d'année", async () => {
      const avYearly = await ctx.agent.post('/api/accounts').send({
        name: 'AV Yearly',
        bank_id: SEED.BANK_ID,
        account_type_id: SEED.AT_AV,
        opening_date: '2023-01-01',
        initial_balance: 0,
      });
      const avId = avYearly.body.id;
      const sup = await ctx.agent.post(`/api/insurance/${avId}/supports`).send({
        name: 'Fonds Euro',
        type: 'euro',
      });
      // Versement en 2023
      await ctx.agent.post(`/api/insurance/${avId}/versement`).send({
        support_id: sup.body.id,
        amount: 3000,
        fees: 0,
        date: '2023-06-01',
      });
      // Intérêts en 2023
      await ctx.agent.post(`/api/insurance/${avId}/interets`).send({
        support_id: sup.body.id,
        amount: 90,
        fees: 0,
        social_fees: 0,
        date: '2023-12-31',
      });

      const res = await ctx.agent.get('/api/stats/profitability');
      const acc = res.body.find((a: { account_id: number }) => a.account_id === avId);
      const year2023 = acc.yearly_returns.find((y: { year: string }) => y.year === '2023');

      expect(year2023).toBeDefined();
      expect(year2023.start_value).toBe(0);
      expect(year2023.net_flows).toBe(3000);
      expect(year2023.gain).toBeCloseTo(90);
    });

    it('compte Bourse : produit de vente non compté dans le capital investi', async () => {
      const courantVente = await ctx.agent.post('/api/accounts').send({
        name: 'Courant Vente',
        bank_id: SEED.BANK_ID,
        account_type_id: SEED.AT_COURANT,
        opening_date: '2023-01-01',
        initial_balance: 0,
      });
      const bourseVente = await ctx.agent.post('/api/accounts').send({
        name: 'PEA Vente',
        bank_id: SEED.BANK_ID,
        account_type_id: SEED.AT_BOURSE,
        opening_date: '2023-01-01',
        initial_balance: 0,
      });
      const bourseVenteId = bourseVente.body.id;
      await ctx.agent.post('/api/transfers').send({
        from_account_id: courantVente.body.id,
        to_account_id: bourseVenteId,
        amount: 1000,
        date: TODAY,
        description: 'Dépôt',
        validated: true,
      });
      await ctx.agent.post(`/api/stocks/${bourseVenteId}/buy`).send({
        ticker: 'SELL1',
        quantity: 5,
        price_per_share: 100,
        fees: 0,
        date: TODAY,
      });
      // Vente 3 × 120€ — produit de cession 360€ ne doit pas gonfler le capital
      await ctx.agent.post(`/api/stocks/${bourseVenteId}/sell`).send({
        ticker: 'SELL1',
        quantity: 3,
        price_per_share: 120,
        fees: 0,
        date: TODAY,
      });
      ctx.db
        .prepare(
          `INSERT OR REPLACE INTO stock_prices (ticker, price, currency, name, fetched_at)
           VALUES ('SELL1', 120, 'EUR', 'Test Sell', ?)`,
        )
        .run(TODAY);

      const res = await ctx.agent.get('/api/stats/profitability');
      const acc = res.body.find((a: { account_id: number }) => a.account_id === bourseVenteId);

      expect(acc).toBeDefined();
      expect(acc.capital_investi).toBe(1000); // produit de vente (360€) exclu
      // cash = 1000 − 500 + 360 = 860 ; stocks = 2 × 120 = 240 → total 1100
      expect(acc.valeur_actuelle).toBeCloseTo(1100);
      expect(acc.plus_value_absolue).toBeCloseTo(100);
    });

    it('compte Épargne : income non-financière comptée comme capital, pas comme plus-value', async () => {
      const epargne2 = await ctx.agent.post('/api/accounts').send({
        name: 'LDD Test',
        bank_id: SEED.BANK_ID,
        account_type_id: SEED.AT_EPARGNE,
        opening_date: '2023-01-01',
        initial_balance: 0,
      });
      // Participation 500€ (Revenus du travail) → capital investi
      await ctx.agent.post('/api/transactions').send({
        account_id: epargne2.body.id,
        type: 'income',
        amount: 500,
        description: 'Participation',
        subcategory_id: SEED.SUBCAT_SALAIRE,
        date: TODAY,
        payment_method_id: SEED.PM_VIREMENT,
        validated: true,
      });
      // Intérêts 15€ (Revenus financiers) → plus-value
      await ctx.agent.post('/api/transactions').send({
        account_id: epargne2.body.id,
        type: 'income',
        amount: 15,
        description: 'Intérêts',
        subcategory_id: SEED.SUBCAT_INTERETS,
        date: TODAY,
        payment_method_id: SEED.PM_VIREMENT,
        validated: true,
      });

      const res = await ctx.agent.get('/api/stats/profitability');
      const acc = res.body.find((a: { account_id: number }) => a.account_id === epargne2.body.id);

      expect(acc).toBeDefined();
      expect(acc.capital_investi).toBe(500);
      expect(acc.valeur_actuelle).toBeCloseTo(515);
      expect(acc.plus_value_absolue).toBeCloseTo(15);
    });

    it("épargne/AV : rendement_annualise_pct exclut l'année en cours", async () => {
      const av2 = await ctx.agent.post('/api/accounts').send({
        name: 'AV ExcludeYtd',
        bank_id: SEED.BANK_ID,
        account_type_id: SEED.AT_AV,
        opening_date: '2023-01-01',
        initial_balance: 0,
      });
      const avId = av2.body.id;
      const sup = await ctx.agent.post(`/api/insurance/${avId}/supports`).send({
        name: 'Fonds Euro',
        type: 'euro',
      });
      await ctx.agent.post(`/api/insurance/${avId}/versement`).send({
        support_id: sup.body.id,
        amount: 10000,
        fees: 0,
        date: '2023-06-01',
      });
      await ctx.agent.post(`/api/insurance/${avId}/interets`).send({
        support_id: sup.body.id,
        amount: 200,
        fees: 0,
        social_fees: 0,
        date: '2023-12-31',
      });
      // Premier appel : aucun intérêt ytd
      const res1 = await ctx.agent.get('/api/stats/profitability');
      const cagr1 = res1.body.find(
        (a: { account_id: number }) => a.account_id === avId,
      )?.rendement_annualise_pct;

      // Ajout de 500€ d'intérêts ytd — si le CAGR les inclut, il changerait
      await ctx.agent.post(`/api/insurance/${avId}/interets`).send({
        support_id: sup.body.id,
        amount: 500,
        fees: 0,
        social_fees: 0,
        date: TODAY,
      });
      const res2 = await ctx.agent.get('/api/stats/profitability');
      const acc2 = res2.body.find((a: { account_id: number }) => a.account_id === avId);

      expect(cagr1).not.toBeNull();
      // Le CAGR ne doit pas changer malgré 500€ d'intérêts ytd supplémentaires
      expect(acc2.rendement_annualise_pct).toBeCloseTo(cagr1, 5);
      // L'année ytd est bien présente dans le tableau mais exclue du CAGR
      expect(acc2.yearly_returns.some((y: { is_ytd: boolean }) => y.is_ytd)).toBe(true);
    });
  });

  describe('getBalanceHistory avec Stocks', () => {
    it('devrait répartir cash non investi en Liquidités et valeur de marché en Actions & UC', async () => {
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

      // Liquidités = Courant initial (10) + Bourse cash non investi (500) = 510
      expect(yearData['Liquidités']).toBe(510);
      // Actions & UC = valeur de marché (10 x 60) pour l'année courante
      expect(yearData['Actions & UC']).toBe(600);
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
