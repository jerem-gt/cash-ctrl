import type { Database } from 'better-sqlite3';

import { dateStr, parseDate } from '../../lib/dateUtils';
import { toCents } from '../../lib/money';
import { applyWeekend, getFirstOccurrence, nextOccurrence } from '../../lib/scheduledLogic';
import { createScheduledRepo } from '../scheduled/scheduled.repo';
import type { ScheduledTransaction } from '../scheduled/scheduled.types';
import type { ForecastAccount, ForecastPoint, ForecastResponse } from './forecast.types';

// Sécurité anti-boucle infinie si une planif est mal formée (récurrence figée, etc.)
const MAX_OCCURRENCE_ITERATIONS = 10000;

interface AccountBalanceRow {
  account_id: number;
  account_name: string;
  bank_id: number;
  balance: number;
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
  addDelta: (accountId: number, date: string, deltaCents: number) => void,
): void {
  const isVersement = sched.insurance_support_id != null;
  const isTransfer = !isVersement && sched.to_account_id != null;
  const amountCents = toCents(sched.amount);
  const endDate = sched.end_date ? parseDate(sched.end_date) : null;

  // On repart toujours de la 1re occurrence (pas de last_generated_until) : les
  // transactions déjà pré-générées (non validées, jusqu'à J+lead_days) ne doivent
  // pas être exclues de la projection sous prétexte qu'elles existent déjà en base.
  let nominal = getFirstOccurrence(sched);

  let iterations = 0;
  while (nominal <= horizon && iterations < MAX_OCCURRENCE_ITERATIONS) {
    iterations++;
    if (endDate && nominal > endDate) break;

    const actual = applyWeekend(nominal, sched.weekend_handling);
    if (actual > today && actual <= horizon) {
      recordOccurrenceDelta(sched, isVersement, isTransfer, amountCents, dateStr(actual), addDelta);
    }

    nominal = nextOccurrence(nominal, sched);
  }
}

export function createForecastRepo(db: Database) {
  const scheduledRepo = createScheduledRepo(db);

  const balanceStmt = db.prepare<{ userId: number }, AccountBalanceRow>(`
    SELECT a.id AS account_id, a.name AS account_name, a.bank_id,
           a.initial_balance + COALESCE(bal.s, 0) AS balance
    FROM accounts a
    LEFT JOIN (
      SELECT account_id, SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS s
      FROM transactions WHERE validated = 1 GROUP BY account_id
    ) bal ON bal.account_id = a.id
    WHERE a.user_id = :userId AND a.closed_at IS NULL
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
      AND li.due_date > :from AND li.due_date <= :to
  `);

  return {
    getForecast(userId: number, horizonDays: number, today: string): ForecastResponse {
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
        addFlowsFromSchedule(sched, todayDate, horizonDate, addDelta);
      }

      const installments = pendingInstallmentsStmt.all({
        userId,
        from: today,
        to: horizonStr,
      });
      for (const inst of installments) {
        addDelta(inst.source_account_id, inst.due_date, -inst.total_amount);
      }

      const accountBalances = balanceStmt.all({ userId });
      const accounts: ForecastAccount[] = [];

      for (const acc of accountBalances) {
        const deltas = deltasByAccount.get(acc.account_id);
        if (!deltas || deltas.size === 0) continue;

        let running = acc.balance;
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

      return { horizon: horizonDays, accounts };
    },
  };
}
