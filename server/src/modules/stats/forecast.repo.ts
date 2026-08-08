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

  // Dernière échéance matérialisée, toutes périodes confondues (passé + futur). Une
  // occurrence avancée à une date passée (payée/validée) tombe hors de la fenêtre de
  // pré-génération : c'est elle en revanche qui ancre la projection de la config.
  const lastScheduledTxStmt = db
    .prepare<{ scheduledId: number; userId: number }, string | null>(
      `SELECT MAX(date) FROM transactions WHERE scheduled_id = :scheduledId AND user_id = :userId`,
    )
    .pluck();

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
    // Au-delà de la dernière échéance connue (validée ou non), on projette la config pour
    // conserver le rythme d'origine au-delà de la fenêtre pré-générée (J+lead_days).
    const lastMaterialized = lastScheduledTxStmt.get({ scheduledId: sched.id, userId }) ?? null;
    addFlowsFromSchedule(sched, todayDate, horizon, lastMaterialized, addDelta);
  };

  const buildForecastAccounts = (
    accountBalances: AccountBalanceRow[],
    deltasByAccount: Map<number, Map<string, number>>,
    todayDate: Date,
    horizonDays: number,
    today: string,
  ): ForecastAccount[] => {
    const accounts: ForecastAccount[] = [];
    for (const acc of accountBalances) {
      const deltas = deltasByAccount.get(acc.account_id);
      if (!deltas || deltas.size === 0) continue;

      // Le point initial inclut le delta du jour meme (occurrence/echeance dues aujourd'hui).
      let running = acc.balance + (deltas.get(today) ?? 0);
      let goesNegativeOn: string | null = running < 0 ? today : null;
      const points: ForecastPoint[] = [{ date: today, balance: running }];

      for (let i = 1; i <= horizonDays; i++) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() + i);
        const dStr = dateStr(d);
        running += deltas.get(dStr) ?? 0;
        points.push({ date: dStr, balance: running });
        if (goesNegativeOn === null && running < 0) goesNegativeOn = dStr;
      }

      accounts.push({
        account_id: acc.account_id,
        account_name: acc.account_name,
        bank_id: acc.bank_id,
        current_balance: acc.balance,
        points,
        goes_negative_on: goesNegativeOn,
      });
    }
    return accounts;
  };

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

      const accountBalances = balanceStmt.all({ userId, accountId: accountId ?? null });
      const accounts = buildForecastAccounts(
        accountBalances,
        deltasByAccount,
        todayDate,
        horizonDays,
        today,
      );

      return { horizon: horizonDays, accounts };
    },
  };
}
