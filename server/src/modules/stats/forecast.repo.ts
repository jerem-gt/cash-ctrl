import type { ForecastAccount, ForecastPoint, ForecastResponse } from '@cashctrl/types';
import type { Database } from 'better-sqlite3';

import { dateStr, parseDate } from '../../lib/dateUtils.js';
import { toCents } from '../../lib/money.js';
import { forEachOccurrence, OccurrenceRange } from '../../lib/scheduledLogic.js';
import { VALIDATED_TX_SUM_SELECT } from '../../lib/sql.js';
import { createScheduledRepo } from '../scheduled/scheduled.repo.js';
import type { ScheduledTransaction } from '../scheduled/scheduled.types.js';

interface AccountBalanceRow {
  account_id: number;
  account_name: string;
  bank_id: number;
  balance: number;
}

/** Échéance d'une planif déjà matérialisée en table `transactions`. */
interface MaterializedRow {
  account_id: number;
  type: 'income' | 'expense';
  amount: number;
  date: string;
  validated: number;
}

interface PendingInstallmentRow {
  due_date: string;
  total_amount: number;
  source_account_id: number;
}

/** Applique le delta (centimes, signé) d'une occurrence unique selon le type de planif. */
function recordOccurrenceDelta(
  sched: ScheduledTransaction,
  isVersement: boolean,
  isTransfer: boolean,
  amountCents: number,
  actualStr: string,
  addDelta: (accountId: number, date: string, deltaCents: number) => void,
): void {
  if (isVersement) {
    // Versement AV/PER : seul le compte source (to_account_id) est débité.
    addDelta(sched.to_account_id!, actualStr, -amountCents);
    return;
  }
  if (isTransfer) {
    addDelta(sched.account_id, actualStr, -amountCents);
    addDelta(sched.to_account_id!, actualStr, amountCents);
    return;
  }
  const sign = sched.type === 'income' ? 1 : -1;
  addDelta(sched.account_id, actualStr, sign * amountCents);
}

/** Cumule les deltas (centimes, signés) par compte et par date d'occurrence réelle. */
function addFlowsFromSchedule(
  sched: ScheduledTransaction,
  today: Date,
  horizon: Date,
  lastMaterialized: string | null,
  addDelta: (accountId: number, date: string, deltaCents: number) => void,
): void {
  const isVersement = sched.insurance_support_id != null;
  const isTransfer = !isVersement && sched.to_account_id != null;
  const amountCents = toCents(sched.amount);

  // Les échéances déjà matérialisées en base (pré-générées jusqu'à J+lead_days) font foi :
  // on reprend la récurrence après la dernière d'entre elles au lieu de repartir de `today`.
  // (cf. manière de génération `generateScheduled`). Sans aucune ligne -> projection de config.
  const range: OccurrenceRange = lastMaterialized
    ? { until: horizon, resumeFrom: lastMaterialized }
    : { from: today, until: horizon };

  forEachOccurrence(sched, range, (actual) => {
    if (actual >= today && actual <= horizon) {
      recordOccurrenceDelta(sched, isVersement, isTransfer, amountCents, dateStr(actual), addDelta);
    }
  });
}

export function createForecastRepo(db: Database) {
  const scheduledRepo = createScheduledRepo(db);

  const scheduledTxStmt = db.prepare<
    { scheduledId: number; userId: number; from: string; to: string },
    MaterializedRow
  >(`
    SELECT account_id, type, amount, date, validated
    FROM transactions
    WHERE scheduled_id = :scheduledId AND user_id = :userId
      AND date >= :from AND date <= :to
    ORDER BY date
  `);

  const balanceStmt = db.prepare<{ userId: number; accountId: number | null }, AccountBalanceRow>(`
    SELECT a.id AS account_id, a.name AS account_name, a.bank_id,
           a.initial_balance + COALESCE(bal.s, 0) AS balance
    FROM accounts a
    LEFT JOIN (
      ${VALIDATED_TX_SUM_SELECT} GROUP BY account_id
    ) bal ON bal.account_id = a.id
    WHERE a.user_id = :userId AND a.closed_at IS NULL
      AND (:accountId IS NULL OR a.id = :accountId)
  `);

  // "Non encore payée" = pas de transaction liée, ou transaction liée non validée
  // (les échéances proches sont pré-générées non-validées par le job planifié).
  const pendingInstallmentsStmt = db.prepare<
    { userId: number; from: string; to: string },
    PendingInstallmentRow
  >(`
    SELECT li.due_date, li.total_amount, l.source_account_id
    FROM loan_installments li
    JOIN loans l ON li.loan_id = l.id
    LEFT JOIN transactions t ON li.transaction_id = t.id
    WHERE l.user_id = :userId
      AND (li.transaction_id IS NULL OR t.validated = 0)
      AND li.due_date >= :from AND li.due_date <= :to
  `);

  const addScheduleRows = (
    sched: ScheduledTransaction,
    userId: number,
    today: string,
    todayDate: Date,
    horizon: Date,
    horizonStr: string,
    addDelta: (accountId: number, date: string, deltaCents: number) => void,
  ): void => {
    const rows = scheduledTxStmt.all({
      scheduledId: sched.id,
      userId,
      from: today,
      to: horizonStr,
    });
    // Deltas des échéances déjà matérialisées (y compris déplacées) : seule source de
    // vérité. Les transactions validées sont déjà dans `current_balance` (somme sans filtre
    // de date) : on ne les re-projette pas (pas de doublon).
    for (const r of rows) {
      if (r.validated === 0) {
        addDelta(r.account_id, r.date, r.type === 'income' ? r.amount : -r.amount);
      }
    }
    // Ancre = dernière date nominale générée (comme generateScheduled) : indépendante des
    // déplacements d'occurrences, contrairement à MAX(transactions.date).
    addFlowsFromSchedule(sched, todayDate, horizon, sched.last_generated_until ?? null, addDelta);
  };

  // Transactions non validées déjà échues : absentes du solde, attendues d'un jour à l'autre.
  const overdueStmt = db.prepare<
    { userId: number; from: string; today: string },
    { account_id: number; date: string; delta: number }
  >(`
    SELECT account_id, date, SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS delta
    FROM transactions
    WHERE user_id = :userId AND validated = 0 AND date >= :from AND date < :today
    GROUP BY account_id, date
  `);

  // Transactions validées de la fenêtre passée : servent à recoller la courbe à l'historique.
  const validatedPastStmt = db.prepare<
    { userId: number; from: string; today: string },
    { account_id: number; date: string; delta: number }
  >(`
    SELECT account_id, date, SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS delta
    FROM transactions
    WHERE user_id = :userId AND validated = 1 AND date >= :from AND date <= :today
    GROUP BY account_id, date
  `);

  const groupByAccount = (
    rows: { account_id: number; date: string; delta: number }[],
  ): Map<number, Map<string, number>> => {
    const map = new Map<number, Map<string, number>>();
    for (const r of rows) {
      let byDate = map.get(r.account_id);
      if (!byDate) {
        byDate = new Map();
        map.set(r.account_id, byDate);
      }
      byDate.set(r.date, r.delta);
    }
    return map;
  };

  /**
   * Segment pointillé rétrospectif : part du solde historique la veille du plus ancien retard
   * (identique à la courbe pleine) et cumule validés + retards jusqu'à hier.
   */
  const buildOverduePoints = (
    acc: AccountBalanceRow,
    overdue: Map<string, number>,
    validatedPast: Map<string, number> | undefined,
    today: string,
  ): ForecastPoint[] => {
    const first = [...overdue.keys()].sort((a, b) => a.localeCompare(b))[0];
    const anchor = parseDate(first);
    anchor.setDate(anchor.getDate() - 1);

    let running = acc.balance;
    for (const [date, v] of validatedPast ?? []) {
      if (date > dateStr(anchor)) running -= v;
    }

    const points: ForecastPoint[] = [{ date: dateStr(anchor), balance: running }];
    for (let d = new Date(anchor); ;) {
      d.setDate(d.getDate() + 1);
      const dStr = dateStr(d);
      if (dStr >= today) break;
      running += (validatedPast?.get(dStr) ?? 0) + (overdue.get(dStr) ?? 0);
      points.push({ date: dStr, balance: running });
    }
    return points;
  };

  const buildForecastAccount = (
    acc: AccountBalanceRow,
    deltas: Map<number, Map<string, number>>,
    overdueByAccount: Map<number, Map<string, number>>,
    validatedPastByAccount: Map<number, Map<string, number>>,
    todayDate: Date,
    horizonDays: number,
    today: string,
  ): ForecastAccount | null => {
    const accDeltas = deltas.get(acc.account_id) ?? new Map<string, number>();
    const overdue = overdueByAccount.get(acc.account_id);
    if (accDeltas.size === 0 && !overdue) return null;

    const overduePoints = overdue
      ? buildOverduePoints(acc, overdue, validatedPastByAccount.get(acc.account_id), today)
      : undefined;
    const overdueTotal = overdue ? [...overdue.values()].reduce((s, v) => s + v, 0) : 0;

    // Le point initial inclut les retards non validés et le delta du jour meme.
    let running = acc.balance + overdueTotal + (accDeltas.get(today) ?? 0);
    let goesNegativeOn: string | null = running < 0 ? today : null;
    const points: ForecastPoint[] = [{ date: today, balance: running }];

    for (let i = 1; i <= horizonDays; i++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() + i);
      const dStr = dateStr(d);
      running += accDeltas.get(dStr) ?? 0;
      points.push({ date: dStr, balance: running });
      if (goesNegativeOn === null && running < 0) goesNegativeOn = dStr;
    }

    return {
      account_id: acc.account_id,
      account_name: acc.account_name,
      bank_id: acc.bank_id,
      current_balance: acc.balance,
      points,
      ...(overduePoints && { overdue_points: overduePoints }),
      goes_negative_on: goesNegativeOn,
    };
  };

  const buildForecastAccounts = (
    accountBalances: AccountBalanceRow[],
    deltasByAccount: Map<number, Map<string, number>>,
    overdueByAccount: Map<number, Map<string, number>>,
    validatedPastByAccount: Map<number, Map<string, number>>,
    todayDate: Date,
    horizonDays: number,
    today: string,
  ): ForecastAccount[] =>
    accountBalances
      .map((acc) =>
        buildForecastAccount(
          acc,
          deltasByAccount,
          overdueByAccount,
          validatedPastByAccount,
          todayDate,
          horizonDays,
          today,
        ),
      )
      .filter((a) => a !== null);

  return {
    getForecast(
      userId: number,
      horizonDays: number,
      today: string,
      accountId?: number,
    ): ForecastResponse {
      const todayDate = parseDate(today);
      const horizonDate = new Date(todayDate);
      horizonDate.setDate(horizonDate.getDate() + horizonDays);
      const horizonStr = dateStr(horizonDate);

      const deltasByAccount = new Map<number, Map<string, number>>();
      const addDelta = (accountId: number, date: string, deltaCents: number) => {
        let byDate = deltasByAccount.get(accountId);
        if (!byDate) {
          byDate = new Map();
          deltasByAccount.set(accountId, byDate);
        }
        byDate.set(date, (byDate.get(date) ?? 0) + deltaCents);
      };

      const schedules = scheduledRepo.getActiveByUserId(userId);
      for (const sched of schedules) {
        addScheduleRows(sched, userId, today, todayDate, horizonDate, horizonStr, addDelta);
      }

      const installments = pendingInstallmentsStmt.all({
        userId,
        from: today,
        to: horizonStr,
      });
      for (const inst of installments) {
        addDelta(inst.source_account_id, inst.due_date, -inst.total_amount);
      }

      // Fenêtre rétrospective = celle de l'historique de solde (horizon jours).
      const lookback = new Date(todayDate);
      lookback.setDate(lookback.getDate() - horizonDays);
      const lookbackStr = dateStr(lookback);
      const overdueByAccount = groupByAccount(
        overdueStmt.all({ userId, from: lookbackStr, today }),
      );
      const validatedPastByAccount = groupByAccount(
        validatedPastStmt.all({ userId, from: lookbackStr, today }),
      );

      const accountBalances = balanceStmt.all({ userId, accountId: accountId ?? null });
      const accounts = buildForecastAccounts(
        accountBalances,
        deltasByAccount,
        overdueByAccount,
        validatedPastByAccount,
        todayDate,
        horizonDays,
        today,
      );

      return { horizon: horizonDays, accounts };
    },
  };
}
