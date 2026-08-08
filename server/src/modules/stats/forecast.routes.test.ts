import { beforeEach, describe, expect, it } from 'vitest';

import { dateStr } from '../../lib/dateUtils.js';
import { toCents } from '../../lib/money.js';
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
    const firstInstallmentCents = toCents(installments.body[0].total_amount);

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

  it('inclut une occurrence planifiee datee du jour meme dans points[0]', async () => {
    await ctx.agent.post('/api/scheduled').send({
      account_id: accountId,
      type: 'expense',
      amount: 40,
      description: 'Depense du jour',
      subcategory_id: SEED.SUBCAT_AUTRE,
      payment_method_id: SEED.PM_CARTE,
      recurrence_unit: 'day',
      recurrence_interval: 1000,
      start_date: daysFromNow(0),
      active: true,
    });

    const res = await ctx.agent.get('/api/stats/forecast?horizon=90');
    expect(res.status).toBe(200);
    const accForecast = (res.body.accounts as ForecastAccountDto[]).find(
      (a) => a.account_id === accountId,
    )!;
    expect(accForecast).toBeTruthy();
    expect(accForecast.current_balance).toBe(100000);

    const today = daysFromNow(0);
    expect(findPoint(accForecast, today)?.balance).toBe(100000 - 4000);
    expect(findPoint(accForecast, daysFromNow(1))?.balance).toBe(100000 - 4000);
    expect(accForecast.goes_negative_on).toBeNull();
  });

  it('inclut une echeance de pret due aujourdhui dans points[0]', async () => {
    ctx.db
      .prepare(
        "INSERT INTO account_types (user_id, name, envelope_type) VALUES (?, 'Prêt', 'loan')",
      )
      .run(ctx.userId);

    const loan = await ctx.agent.post('/api/loans').send({
      name: 'Pret jour meme',
      bank_id: SEED.BANK_ID,
      opening_date: '2024-01-01',
      principal_amount: 12000,
      interest_rate: 0.12,
      duration_months: 12,
      start_date: daysFromNow(0),
      source_account_id: accountId,
      deposit_account_id: destAccountId,
    });
    expect(loan.status).toBe(201);

    const installments = await ctx.agent.get(`/api/loans/${loan.body.id}/installments`);
    const firstInstallmentCents = toCents(installments.body[0].total_amount);

    const res = await ctx.agent.get('/api/stats/forecast?horizon=90');
    expect(res.status).toBe(200);
    const accForecast = (res.body.accounts as ForecastAccountDto[]).find(
      (a) => a.account_id === accountId,
    )!;
    expect(accForecast).toBeTruthy();

    const today = daysFromNow(0);
    expect(findPoint(accForecast, today)?.balance).toBe(100000 - firstInstallmentCents);
    expect(findPoint(accForecast, daysFromNow(1))?.balance).toBe(100000 - firstInstallmentCents);
  });

  it("après avoir déplacé une occurrence (unique) à aujourd'hui + validation, ne la projette plus à l'ancienne date", async () => {
    const sched = await ctx.agent.post('/api/scheduled').send({
      account_id: accountId,
      type: 'expense',
      amount: 100,
      description: 'Prélèvement à déplacer',
      subcategory_id: SEED.SUBCAT_AUTRE,
      payment_method_id: SEED.PM_CARTE,
      recurrence_unit: 'day',
      recurrence_interval: 1000,
      start_date: daysFromNow(5),
      active: true,
    });
    expect(sched.status).toBe(201);
    const scheduledId = sched.body.id;

    const txs = await ctx.agent.get(`/api/transactions?scheduled_id=${scheduledId}`);
    const oldTx = (txs.body.data as { id: number; date: string }[])[0];
    const oldDate = oldTx.date;
    expect(oldDate).toBe(daysFromNow(5));

    // L'utilisateur déplace la transaction pré-générée à aujourd'hui et la valide.
    const move = await ctx.agent.put(`/api/transactions/${oldTx.id}`).send({
      account_id: accountId,
      type: 'expense',
      amount: 100,
      description: 'Prélèvement à déplacer',
      subcategory_id: SEED.SUBCAT_AUTRE,
      payment_method_id: SEED.PM_CARTE,
      date: daysFromNow(0),
      validated: true,
      scheduled_id: scheduledId,
    });
    expect(move.status).toBe(200);

    const fc = await ctx.agent.get(`/api/stats/forecast?horizon=30&account_id=${accountId}`);
    const acc = (fc.body.accounts as ForecastAccountDto[]).find((a) => a.account_id === accountId);
    // Dépense consommée aujourd'hui (validée, dans le solde courant) : plus aucune
    // échéance future à projeter → le compte n'apparaît pas dans le forecast
    // (l'ancienne date n'est PAS reprojetée).
    expect(acc).toBeUndefined();
  });

  it('déplacer une occurrence récurrente : ancienne date non projetée, rythme des suivantes conservé', async () => {
    const sched = await ctx.agent.post('/api/scheduled').send({
      account_id: accountId,
      type: 'expense',
      amount: 50,
      description: 'Loyer',
      subcategory_id: SEED.SUBCAT_AUTRE,
      payment_method_id: SEED.PM_CARTE,
      recurrence_unit: 'week',
      recurrence_interval: 1,
      start_date: daysFromNow(14),
      active: true,
    });
    expect(sched.status).toBe(201);
    const scheduledId = sched.body.id;

    const txs = await ctx.agent.get(`/api/transactions?scheduled_id=${scheduledId}`);
    const rows = txs.body.data as Array<{ id: number; date: string }>;
    const first = rows.find((r) => r.date === daysFromNow(14))!;
    const second = rows.find((r) => r.date === daysFromNow(21))!;
    expect(second).toBeTruthy();

    await ctx.agent.put(`/api/transactions/${first.id}`).send({
      account_id: accountId,
      type: 'expense',
      amount: 50,
      description: 'Loyer',
      subcategory_id: SEED.SUBCAT_AUTRE,
      payment_method_id: SEED.PM_CARTE,
      date: daysFromNow(0),
      validated: true,
      scheduled_id: scheduledId,
    });

    const fc = await ctx.agent.get(`/api/stats/forecast?horizon=90&account_id=${accountId}`);
    const acc = (fc.body.accounts as ForecastAccountDto[]).find((a) => a.account_id === accountId)!;

    // L'ancienne occurrence (jours 14) a disparu…
    const prevOfDay14 = findPoint(acc, daysFromNow(13))?.balance ?? 0;
    const atDay14 = findPoint(acc, daysFromNow(14))?.balance ?? 0;
    expect(prevOfDay14 - atDay14).toBe(0);

    // …mais le rythme se poursuit (jours 21, 28…) : une nouvelle échéance est bien projetée.
    let sawLaterDip = false;
    for (const p of acc.points) {
      if (p.balance < acc.points[0].balance) sawLaterDip = true;
    }
    expect(sawLaterDip).toBe(true);
    expect(findPoint(acc, daysFromNow(21))?.balance).toBeLessThan(acc.points[0].balance);
  });

  it("loyer avancé : déplacer l'occurrence à une date passée ne la réapparaît pas dans le forecast", async () => {
    const sched = await ctx.agent.post('/api/scheduled').send({
      account_id: accountId,
      type: 'expense',
      amount: 200,
      description: 'Loyer avancé',
      subcategory_id: SEED.SUBCAT_AUTRE,
      payment_method_id: SEED.PM_CARTE,
      recurrence_unit: 'day',
      recurrence_interval: 1000,
      start_date: daysFromNow(15),
      active: true,
    });
    expect(sched.status).toBe(201);
    const scheduledId = sched.body.id;

    const txs = await ctx.agent.get(`/api/transactions?scheduled_id=${scheduledId}`);
    const oldTx = (txs.body.data as { id: number; date: string }[])[0];
    const oldDate = oldTx.date;
    expect(oldDate).toBe(daysFromNow(15));

    // L'utilisateur avance le loyer : déplacement de l'occurrence pré-générée à hier
    // (date passée) + validation. Le tampon de pré-génération devient vide.
    const move = await ctx.agent.put(`/api/transactions/${oldTx.id}`).send({
      account_id: accountId,
      type: 'expense',
      amount: 200,
      description: 'Loyer avancé',
      subcategory_id: SEED.SUBCAT_AUTRE,
      payment_method_id: SEED.PM_CARTE,
      date: daysFromNow(-1),
      validated: true,
      scheduled_id: scheduledId,
    });
    expect(move.status).toBe(200);

    const fc = await ctx.agent.get(`/api/stats/forecast?horizon=90&account_id=${accountId}`);
    const acc = (fc.body.accounts as ForecastAccountDto[]).find((a) => a.account_id === accountId);
    // Le loyer est déjà payé (hier, dans le solde courant) : plus aucune échéance dans
    // la fenêtre 90 j → le compte ne doit PAS réapparaître en projetant l'ancienne date.
    expect(acc).toBeUndefined();
  });

  it('projette un transfert au-delà du tampon de pré-génération (fallback config, 2 comptes)', async () => {
    await ctx.agent.post('/api/scheduled').send({
      account_id: accountId,
      to_account_id: destAccountId,
      type: 'expense',
      amount: 60,
      description: 'Virement périodique',
      payment_method_id: SEED.PM_TRANSFERT,
      recurrence_unit: 'day',
      recurrence_interval: 40,
      start_date: daysFromNow(0),
      active: true,
    });

    const fc = await ctx.agent.get(`/api/stats/forecast?horizon=90`);
    const accounts = fc.body.accounts as ForecastAccountDto[];
    const acc = accounts.find((a) => a.account_id === accountId)!;
    const dest = accounts.find((a) => a.account_id === destAccountId)!;
    expect(acc).toBeTruthy();
    expect(dest).toBeTruthy();

    // L'occurrence pré-générée (J0) vit en base ; au-delà (J+40 > lead), la config est
    // re-projetée : débit sur le compte source, crédit sur le compte destination.
    const prevAcc = findPoint(acc, daysFromNow(39))?.balance ?? 0;
    expect(prevAcc - (findPoint(acc, daysFromNow(40))?.balance ?? 0)).toBe(6000);
    const prevDest = findPoint(dest, daysFromNow(39))?.balance ?? 0;
    expect((findPoint(dest, daysFromNow(40))?.balance ?? 0) - prevDest).toBe(6000);
  });

  it('projette un versement AV au-delà du tampon (seul le compte source est débité)', async () => {
    const av = await ctx.agent.post('/api/accounts').send({
      name: 'PER test',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_PER,
      opening_date: '2020-01-01',
      initial_balance: 0,
    });
    const avAccountId = av.body.id;
    const sup = await ctx.agent
      .post(`/api/insurance/${avAccountId}/supports`)
      .send({ account_id: avAccountId, name: 'Fonds Euro', type: 'euro' });
    const supportId = sup.body.id;

    const sched = await ctx.agent.post('/api/scheduled').send({
      account_id: avAccountId,
      to_account_id: accountId,
      insurance_support_id: supportId,
      insurance_fees: 0,
      type: 'expense',
      amount: 80,
      description: 'Versement PER périodique',
      recurrence_unit: 'day',
      recurrence_interval: 40,
      start_date: daysFromNow(0),
      active: true,
    });
    expect(sched.status).toBe(201);

    const fc = await ctx.agent.get(`/api/stats/forecast?horizon=90`);
    const accounts = fc.body.accounts as ForecastAccountDto[];
    const acc = accounts.find((a) => a.account_id === accountId)!;
    expect(acc).toBeTruthy();

    // Seul le compte source (to_account_id) est débité au-delà du tampon (J+40).
    const prev = findPoint(acc, daysFromNow(39))?.balance ?? 0;
    expect(prev - (findPoint(acc, daysFromNow(40))?.balance ?? 0)).toBe(8000);
    // Le compte AV n'est pas côté dans le forecast (l'apport passe par insurance_operations).
    const avInFc = accounts.find((a) => a.account_id === avAccountId);
    expect(avInFc).toBeUndefined();
  });

  it('projette depuis la config quand le tampon de pré-génération est encore vide', async () => {
    await ctx.agent.post('/api/scheduled').send({
      account_id: accountId,
      type: 'expense',
      amount: 30,
      description: 'Abonnement hors tampon',
      subcategory_id: SEED.SUBCAT_AUTRE,
      payment_method_id: SEED.PM_CARTE,
      recurrence_unit: 'day',
      recurrence_interval: 50,
      start_date: daysFromNow(45),
      active: true,
    });

    // Aucune occurrence matérialisée (J+45 > tampon J+30) : le fallback part de `today`
    // et projette la première occurrence config à J+45 dans la fenêtre 90 j.
    const fc = await ctx.agent.get(`/api/stats/forecast?horizon=90`);
    const acc = (fc.body.accounts as ForecastAccountDto[]).find((a) => a.account_id === accountId)!;
    expect(acc).toBeTruthy();
    const prev = findPoint(acc, daysFromNow(44))?.balance ?? 0;
    expect(prev - (findPoint(acc, daysFromNow(45))?.balance ?? 0)).toBe(3000);
  });

  it('crédite un revenu planifié projeté depuis la config (income)', async () => {
    await ctx.agent.post('/api/scheduled').send({
      account_id: accountId,
      type: 'income',
      amount: 40,
      description: 'Rémunération hors tampon',
      subcategory_id: SEED.SUBCAT_AUTRE,
      payment_method_id: SEED.PM_CARTE,
      recurrence_unit: 'day',
      recurrence_interval: 50,
      start_date: daysFromNow(45),
      active: true,
    });

    const fc = await ctx.agent.get(`/api/stats/forecast?horizon=90`);
    const acc = (fc.body.accounts as ForecastAccountDto[]).find((a) => a.account_id === accountId)!;
    expect(acc).toBeTruthy();
    const prev = findPoint(acc, daysFromNow(44))?.balance ?? 0;
    expect((findPoint(acc, daysFromNow(45))?.balance ?? 0) - prev).toBe(4000);
  });

  it('account_id filtre le forecast sur le seul compte demande', async () => {
    await ctx.agent.post('/api/scheduled').send({
      account_id: accountId,
      to_account_id: destAccountId,
      type: 'expense',
      amount: 50,
      description: 'Transfert',
      payment_method_id: SEED.PM_TRANSFERT,
      recurrence_unit: 'day',
      recurrence_interval: 1000,
      start_date: daysFromNow(5),
      active: true,
    });

    const res = await ctx.agent.get(`/api/stats/forecast?horizon=90&account_id=${accountId}`);
    expect(res.status).toBe(200);
    const ids = (res.body.accounts as ForecastAccountDto[]).map((a) => a.account_id);
    expect(ids).toEqual([accountId]);
  });

  it('account_id 404 si le compte ne nous appartient pas', async () => {
    const res = await ctx.agent.get('/api/stats/forecast?horizon=90&account_id=999999');
    expect(res.status).toBe(404);
  });
});
