import { beforeEach, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

describe('GET /api/search', () => {
  let ctx: TestContext;
  let accountId: number;

  beforeEach(async () => {
    ctx = await createTestContext();

    const acc = await ctx.agent.post('/api/accounts').send({
      name: 'Compte Café',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2020-01-01',
      initial_balance: 100,
    });
    accountId = acc.body.id;
  });

  it('retourne 400 si q est absent', async () => {
    const res = await ctx.agent.get('/api/search');
    expect(res.status).toBe(400);
  });

  it('retourne 400 si q fait moins de 2 caractères', async () => {
    const res = await ctx.agent.get('/api/search?q=a');
    expect(res.status).toBe(400);
  });

  it('retourne les résultats groupés (comptes, transactions, planifications, titres)', async () => {
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 4.5,
      description: 'Café du matin',
      subcategory_id: SEED.SUBCAT_AUTRE,
      payment_method_id: SEED.PM_CARTE,
      date: '2026-06-01',
      validated: true,
    });
    // start_date lointain : évite que la génération automatique des occurrences
    // (lead_days) ne crée des transactions "Abonnement café" qui polluent le
    // groupe transactions du test (celui-ci ne doit contenir que "Café du matin").
    await ctx.agent.post('/api/scheduled').send({
      account_id: accountId,
      type: 'expense',
      amount: 9,
      description: 'Abonnement café',
      subcategory_id: SEED.SUBCAT_AUTRE,
      payment_method_id: SEED.PM_CARTE,
      recurrence_unit: 'month',
      recurrence_interval: 1,
      start_date: '2030-01-01',
      active: true,
    });
    ctx.db
      .prepare(
        'INSERT INTO stock_positions (user_id, account_id, ticker, quantity, avg_price) VALUES (?, ?, ?, ?, ?)',
      )
      .run(ctx.userId, accountId, 'CAFE', 5, 10);

    const res = await ctx.agent.get('/api/search?q=café');
    expect(res.status).toBe(200);
    expect(res.body.accounts).toHaveLength(1);
    expect(res.body.accounts[0].name).toBe('Compte Café');
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0].description).toBe('Café du matin');
    expect(res.body.scheduled).toHaveLength(1);
    expect(res.body.scheduled[0].description).toBe('Abonnement café');
    expect(res.body.stocks).toHaveLength(1);
    expect(res.body.stocks[0].ticker).toBe('CAFE');
  });

  it('est insensible aux accents et à la casse', async () => {
    const res1 = await ctx.agent.get('/api/search?q=cafe');
    expect(res1.status).toBe(200);
    expect(res1.body.accounts).toHaveLength(1);

    const res2 = await ctx.agent.get('/api/search?q=CAFÉ');
    expect(res2.status).toBe(200);
    expect(res2.body.accounts).toHaveLength(1);
  });

  it('matche sur les notes des transactions', async () => {
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 30,
      description: 'Dépense diverse',
      notes: 'Réunion clients importante',
      subcategory_id: SEED.SUBCAT_AUTRE,
      payment_method_id: SEED.PM_CARTE,
      date: '2026-06-01',
      validated: true,
    });

    const res = await ctx.agent.get('/api/search?q=reunion');
    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0].description).toBe('Dépense diverse');
  });

  it("isole les résultats par utilisateur : les données d'un autre user n'apparaissent pas", async () => {
    const ctx2 = await createTestContext();
    await ctx2.agent.post('/api/accounts').send({
      name: 'Compte Café Autre User',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2020-01-01',
      initial_balance: 0,
    });

    const res = await ctx.agent.get('/api/search?q=café');
    expect(res.status).toBe(200);
    expect(res.body.accounts).toHaveLength(1);
    expect(res.body.accounts[0].name).toBe('Compte Café');
  });

  it('échappe les caractères % et _ du terme recherché', async () => {
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 20,
      description: 'Remise 20%_special',
      subcategory_id: SEED.SUBCAT_AUTRE,
      payment_method_id: SEED.PM_CARTE,
      date: '2026-06-01',
      validated: true,
    });
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 15,
      description: 'Autre depense',
      subcategory_id: SEED.SUBCAT_AUTRE,
      payment_method_id: SEED.PM_CARTE,
      date: '2026-06-02',
      validated: true,
    });

    const res = await ctx.agent.get('/api/search?q=' + encodeURIComponent('20%_special'));
    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0].description).toBe('Remise 20%_special');
  });

  it('limite à 8 résultats par groupe', async () => {
    for (let i = 0; i < 10; i++) {
      await ctx.agent.post('/api/transactions').send({
        account_id: accountId,
        type: 'expense',
        amount: 5,
        description: `Café numero ${i}`,
        subcategory_id: SEED.SUBCAT_AUTRE,
        payment_method_id: SEED.PM_CARTE,
        date: '2026-06-01',
        validated: true,
      });
    }

    const res = await ctx.agent.get('/api/search?q=café');
    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(8);
  });
});
