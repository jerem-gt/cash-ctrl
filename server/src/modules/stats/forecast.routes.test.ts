import { beforeEach, describe, expect, it } from 'vitest';

import { dateStr } from '../../lib/dateUtils';
import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

interface ForecastPointDto {
  date: string;
  balance: number;
}

interface ForecastAccountDto {
  account_id: number;
  account_name: string;
  bank_id: number;
  current_balance: number;
  points: ForecastPointDto[];
  goes_negative_on: string | null;
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dateStr(d);
}

function findPoint(acc: ForecastAccountDto, date: string): ForecastPointDto | undefined {
  return acc.points.find((p) => p.date === date);
}

describe('GET /api/stats/forecast', () => {
  let ctx: TestContext;
  let accountId: number;
  let destAccountId: number;
  let idleAccountId: number;

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

    const dest = await ctx.agent.post('/api/accounts').send({
      name: 'Épargne',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_EPARGNE,
      opening_date: '2020-01-01',
      initial_balance: 0,
    });
    destAccountId = dest.body.id;

    const idle = await ctx.agent.post('/api/accounts').send({
      name: 'Sans flux',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      opening_date: '2020-01-01',
      initial_balance: 50,
    });
    idleAccountId = idle.body.id;
  });

  it('retourne 400 si horizon invalide', async () => {
    const res = await ctx.agent.get('/api/stats/forecast?horizon=60');
    expect(res.status).toBe(400);
  });

  it('accepte horizon=30 et utilise 90 par defaut', async () => {
    const res30 = await ctx.agent.get('/api/stats/forecast?horizon=30');
    expect(res30.status).toBe(200);
    expect(res30.body.horizon).toBe(30);

    const resDefault = await ctx.agent.get('/api/stats/forecast');
    expect(resDefault.status).toBe(200);
    expect(resDefault.body.horizon).toBe(90);
  });

  it("exclut les comptes sans flux futur, n'inclut que ceux concernes", async () => {
    await ctx.agent.post('/api/scheduled').send({
      account_id: accountId,
      type: 'expense',
      amount: 10,
      description: 'Ponctuelle future',
      subcategory_id: SEED.SUBCAT_AUTRE,
      payment_method_id: SEED.PM_CARTE,
      recurrence_unit: 'day',
      recurrence_interval: 1000,
      start_date: daysFromNow(3),
      active: true,
    });

    const res = await ctx.agent.get('/api/stats/forecast?horizon=90');
    expect(res.status).toBe(200);
    const ids = (res.body.accounts as ForecastAccountDto[]).map((a) => a.account_id);
    expect(ids).toContain(accountId);
    expect(ids).not.toContain(idleAccountId);
  });

  it('projette planifiee mensuelle + transfert + echeance de pret sur 90 jours', async () => {
    await ctx.agent.post('/api/scheduled').send({
      account_id: accountId,
      type: 'expense',
      amount: 1500,
      description: 'Grosse depense mensuelle',
      subcategory_id: SEED.SUBCAT_AUTRE,
      payment_method_id: SEED.PM_CARTE,
      recurrence_unit: 'month',
      recurrence_interval: 1,
      start_date: daysFromNow(5),
      active: true,
    });

    await ctx.agent.post('/api/scheduled').send({
      account_id: accountId,
      to_account_id: destAccountId,
      type: 'expense',
      amount: 200,
      description: 'Transfert vers epargne',
      payment_method_id: SEED.PM_TRANSFERT,
      recurrence_unit: 'day',
      recurrence_interval: 1000,
      start_date: daysFromNow(20),
      active: true,
    });

    ctx.db
      .prepare(
        "INSERT INTO account_types (user_id, name, envelope_type) VALUES (?, 'Prêt', 'loan')",
      )
      .run(ctx.userId);

    const loan = await ctx.agent.post('/api/loans').send({
      name: 'Pret test',
      bank_id: SEED.BANK_ID,
      opening_date: '2024-01-01',
      principal_amount: 12000,
      interest_rate: 0.12,
      duration_months: 12,
      start_date: daysFromNow(10),
      source_account_id: accountId,
      deposit_account_id: destAccountId,
    });
    expect(loan.status).toBe(201);

    const installments = await ctx.agent.get(`/api/loans/${loan.body.id}/installments`);
    const firstInstallmentCents = Math.round(installments.body[0].total_amount * 100);

    const res = await ctx.agent.get('/api/stats/forecast?horizon=90');
    expect(res.status).toBe(200);
    expect(res.body.horizon).toBe(90);

    const accForecast = (res.body.accounts as ForecastAccountDto[]).find(
      (a) => a.account_id === accountId,
    )!;
    expect(accForecast).toBeTruthy();
    expect(accForecast.current_balance).toBe(100000);

    const day1 = daysFromNow(1);
    const day5 = daysFromNow(5);
    const day10 = daysFromNow(10);
    const day20 = daysFromNow(20);

    expect(findPoint(accForecast, day1)?.balance).toBe(100000);
    expect(findPoint(accForecast, day5)?.balance).toBe(100000 - 150000);
    expect(findPoint(accForecast, day10)?.balance).toBe(100000 - 150000 - firstInstallmentCents);
    expect(findPoint(accForecast, day20)?.balance).toBe(
      100000 - 150000 - firstInstallmentCents - 20000,
    );

    // Solde passe negatif des la mensualite du jour 5
    expect(accForecast.goes_negative_on).toBe(day5);

    const destForecast = (res.body.accounts as ForecastAccountDto[]).find(
      (a) => a.account_id === destAccountId,
    )!;
    // Le versement initial du pret (deposit_account_id) est valide des la creation du pret
    const disbursement = 1200000; // principal_amount 12000€ en centimes
    expect(destForecast).toBeTruthy();
    expect(destForecast.current_balance).toBe(disbursement);
    expect(findPoint(destForecast, daysFromNow(19))?.balance).toBe(disbursement);
    expect(findPoint(destForecast, day20)?.balance).toBe(disbursement + 20000);
    expect(destForecast.goes_negative_on).toBeNull();
  });
});
