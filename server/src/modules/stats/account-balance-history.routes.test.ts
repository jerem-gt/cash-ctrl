import { beforeEach, describe, expect, it } from 'vitest';

import { dateStr } from '../../lib/dateUtils';
import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

interface BalanceHistoryPointDto {
  date: string;
  balance: number;
}

interface BalanceHistoryDto {
  account_id: number;
  days: number;
  points: BalanceHistoryPointDto[];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateStr(d);
}

function findPoint(res: BalanceHistoryDto, date: string): BalanceHistoryPointDto | undefined {
  return res.points.find((p) => p.date === date);
}

describe('GET /api/stats/accounts/:accountId/balance-history', () => {
  let ctx: TestContext;
  let accountId: number;

  beforeEach(async () => {
    ctx = await createTestContext();

    const acc = await ctx.agent.post('/api/accounts').send({
      name: 'Courant',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2020-01-01',
      initial_balance: 1000,
    });
    accountId = acc.body.id;
  });

  it('retourne 400 si days invalide', async () => {
    const res = await ctx.agent.get(`/api/stats/accounts/${accountId}/balance-history?days=60`);
    expect(res.status).toBe(400);
  });

  it('retourne 404 pour un compte inconnu', async () => {
    const res = await ctx.agent.get('/api/stats/accounts/99999/balance-history');
    expect(res.status).toBe(404);
  });

  it("retourne 404 pour un compte n'appartenant pas a l'utilisateur", async () => {
    const other = ctx.db
      .prepare("INSERT INTO users (username, password_hash) VALUES ('other', 'x')")
      .run();
    const otherAccount = ctx.db
      .prepare(
        'INSERT INTO accounts (user_id, name, bank_id, account_type_id, opening_date, initial_balance) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(other.lastInsertRowid, 'Compte autre', SEED.BANK_ID, SEED.AT_COURANT, '2020-01-01', 0);

    const res = await ctx.agent.get(
      `/api/stats/accounts/${otherAccount.lastInsertRowid}/balance-history`,
    );
    expect(res.status).toBe(404);
  });

  it('accepte days=30 et utilise 90 par defaut', async () => {
    const res30 = await ctx.agent.get(`/api/stats/accounts/${accountId}/balance-history?days=30`);
    expect(res30.status).toBe(200);
    expect(res30.body.days).toBe(30);
    expect(res30.body.points).toHaveLength(30);

    const resDefault = await ctx.agent.get(`/api/stats/accounts/${accountId}/balance-history`);
    expect(resDefault.status).toBe(200);
    expect(resDefault.body.days).toBe(90);
    expect(resDefault.body.points).toHaveLength(90);
  });

  it('reconstruit le solde journalier autour de transactions validees a des dates differentes', async () => {
    // Solde initial 1000€. Une depense validee il y a 10 jours (300€), un revenu valide il y a 3 jours (50€).
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 300,
      description: 'Depense passee',
      subcategory_id: SEED.SUBCAT_AUTRE,
      payment_method_id: SEED.PM_CARTE,
      date: daysAgo(10),
      validated: true,
    });

    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'income',
      amount: 50,
      description: 'Revenu passe',
      subcategory_id: SEED.SUBCAT_AUTRE,
      payment_method_id: SEED.PM_CARTE,
      date: daysAgo(3),
      validated: true,
    });

    const res = await ctx.agent.get(`/api/stats/accounts/${accountId}/balance-history?days=30`);
    expect(res.status).toBe(200);
    const body = res.body as BalanceHistoryDto;

    // Aujourd'hui : 1000 - 300 + 50 = 750€ => 75000 centimes
    expect(findPoint(body, daysAgo(0))?.balance).toBe(75000);
    // Avant le revenu (J-4) : 1000 - 300 = 700€
    expect(findPoint(body, daysAgo(4))?.balance).toBe(70000);
    // Avant la depense (J-11) : 1000€
    expect(findPoint(body, daysAgo(11))?.balance).toBe(100000);
    expect(body.points[0]?.date).toBe(daysAgo(29));
    expect(body.points[29]?.date).toBe(daysAgo(0));
  });
});
