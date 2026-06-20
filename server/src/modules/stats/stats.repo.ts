import type { Database } from 'better-sqlite3';

import { toEuros } from '../../lib/money';
import { parseSplits, TransactionRow, TX_WITH_DETAILS } from '../transactions/transactions.repo';
import type { Transaction } from '../transactions/transactions.types';
import { marketValueByAccount } from './investment-profitability.repo';
import { createProfitabilityRepo } from './profitability.repo';
import { createReportRepo } from './report.repo';
import { buildPositionsAt, firstDayOfMonth, sumDeltasBefore } from './stats.calculations';

export type { MonthlyStat, ReportData } from './report.repo';

export interface BalanceHistoryData {
  account_types: string[];
  data: Array<Record<string, string | number>>; // { year, [type]: balance }
}

export interface DashboardStats {
  month_income: number;
  month_expense: number;
  monthly: import('./report.repo').MonthlyStat[];
  expenses_by_category: Array<{ category: string; amount: number }>;
  recent: Transaction[];
  to_validate: Transaction[];
  upcoming: Transaction[];
}

interface AccountCashRow {
  account_id: number;
  envelope_type: string | null;
  initial_balance: number;
}

/** Delta cash signé (centimes) par compte et par année, validées uniquement. */
function buildYearlyDeltaByAccount(db: Database, userId: number): Map<number, Map<string, number>> {
  const map = new Map<number, Map<string, number>>();
  for (const r of db
    .prepare<[number], { account_id: number; year: string; delta: number }>(
      `SELECT account_id, strftime('%Y', date) AS year,
              SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS delta
       FROM transactions
       WHERE user_id = ? AND validated = 1
       GROUP BY account_id, year`,
    )
    .all(userId)) {
    let byYear = map.get(r.account_id);
    if (!byYear) {
      byYear = new Map();
      map.set(r.account_id, byYear);
    }
    byYear.set(r.year, r.delta);
  }
  return map;
}

/**
 * Solde cash cumulé (en centimes) par compte à la fin de chaque année affichée.
 * Deux requêtes (comptes + deltas annuels) puis cumul en JS, en amorçant chaque
 * compte avec son solde initial + les deltas antérieurs à la 1re année affichée.
 */
function buildCashByYear(
  db: Database,
  userId: number,
  years: string[],
  startYear: number,
): { accountRows: AccountCashRow[]; cashByYear: Map<string, Map<number, number>> } {
  const accountRows = db
    .prepare<[number], AccountCashRow>(
      `SELECT a.id AS account_id, at.envelope_type, a.initial_balance
       FROM accounts a
       LEFT JOIN account_types at ON a.account_type_id = at.id
       WHERE a.user_id = ?`,
    )
    .all(userId);

  const deltaByAccount = buildYearlyDeltaByAccount(db, userId);

  const runningCash = new Map<number, number>();
  for (const acc of accountRows) {
    const seed =
      acc.initial_balance + sumDeltasBefore(deltaByAccount.get(acc.account_id), startYear);
    runningCash.set(acc.account_id, seed);
  }

  const cashByYear = new Map<string, Map<number, number>>();
  for (const year of years) {
    for (const acc of accountRows) {
      const delta = deltaByAccount.get(acc.account_id)?.get(year) ?? 0;
      runningCash.set(acc.account_id, runningCash.get(acc.account_id)! + delta);
    }
    cashByYear.set(year, new Map(runningCash));
  }

  return { accountRows, cashByYear };
}

export function createStatsRepo(db: Database) {
  const profitabilityRepo = createProfitabilityRepo(db);
  const reportRepo = createReportRepo(db);

  return {
    getDashboardStats(userId: number, today: string): DashboardStats {
      const thisMonthStart = firstDayOfMonth(0);
      const nextMonthStart = firstDayOfMonth(-1);
      const sixMonthsStart = firstDayOfMonth(5);

      const EXCLUDE_INSURANCE_TX = `AND id NOT IN (
        SELECT transaction_id FROM insurance_operations WHERE transaction_id IS NOT NULL
      )`;

      const metricsRow = db
        .prepare<[number, string, string], { income: number; expense: number }>(
          `SELECT
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense
          FROM transactions
          WHERE user_id = ? AND validated = 1 AND transfer_peer_id IS NULL
            ${EXCLUDE_INSURANCE_TX}
            AND date >= ? AND date < ?`,
        )
        .get(userId, thisMonthStart, nextMonthStart) ?? { income: 0, expense: 0 };

      const monthlyRows = db
        .prepare<[number, string, string], { month: string; income: number; expense: number }>(
          `SELECT
            strftime('%Y-%m', date) AS month,
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense
          FROM transactions
          WHERE user_id = ? AND validated = 1 AND transfer_peer_id IS NULL
            ${EXCLUDE_INSURANCE_TX}
            AND date >= ? AND date < ?
          GROUP BY month
          ORDER BY month`,
        )
        .all(userId, sixMonthsStart, nextMonthStart);

      const monthMap = new Map(monthlyRows.map((r) => [r.month, r]));
      const monthly = Array.from({ length: 6 }, (_, i) => {
        const key = firstDayOfMonth(5 - i).slice(0, 7);
        const row = monthMap.get(key);
        return {
          month: key,
          income: toEuros(row?.income ?? 0),
          expense: toEuros(row?.expense ?? 0),
        };
      });

      const catRows = db
        .prepare<[number, string, string], { category: string; amount: number }>(
          `SELECT COALESCE(c.name, '') AS category, SUM(t.amount) AS amount
          FROM transactions t
          LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
          LEFT JOIN categories c ON sc.category_id = c.id
          WHERE t.user_id = ? AND t.validated = 1 AND t.transfer_peer_id IS NULL
            AND t.id NOT IN (SELECT transaction_id FROM insurance_operations WHERE transaction_id IS NOT NULL)
            AND t.type = 'expense' AND t.date >= ? AND t.date < ?
          GROUP BY category
          ORDER BY amount DESC`,
        )
        .all(userId, thisMonthStart, nextMonthStart);

      const recent = db
        .prepare<[number], TransactionRow>(
          `${TX_WITH_DETAILS} WHERE t.user_id = ? AND t.validated = 1
          GROUP BY t.id ORDER BY t.date DESC, t.id DESC LIMIT 6`,
        )
        .all(userId)
        .map(parseSplits);

      const to_validate = db
        .prepare<[number, string], TransactionRow>(
          `${TX_WITH_DETAILS} WHERE t.user_id = ? AND t.validated = 0 AND t.date <= ?
          GROUP BY t.id ORDER BY t.date DESC, t.id DESC LIMIT 5`,
        )
        .all(userId, today)
        .map(parseSplits);

      const upcoming = db
        .prepare<[number, string], TransactionRow>(
          `${TX_WITH_DETAILS} WHERE t.user_id = ? AND t.scheduled_id IS NOT NULL AND t.date > ?
          GROUP BY t.id ORDER BY t.date ASC, t.id ASC LIMIT 5`,
        )
        .all(userId, today)
        .map(parseSplits);

      return {
        month_income: toEuros(metricsRow.income),
        month_expense: toEuros(metricsRow.expense),
        monthly,
        expenses_by_category: catRows.map((r) => ({ ...r, amount: toEuros(r.amount) })),
        recent,
        to_validate,
        upcoming,
      };
    },

    getBalanceHistory(userId: number): BalanceHistoryData {
      const firstYearRow = db
        .prepare<[number], { year: string | null }>(
          `SELECT MIN(strftime('%Y', date)) AS year
           FROM transactions WHERE user_id = ? AND validated = 1`,
        )
        .get(userId);

      const currentYear = new Date().getUTCFullYear();
      const startYear = firstYearRow?.year ? Number.parseInt(firstYearRow.year, 10) : currentYear;

      const years: string[] = [];
      for (let y = startYear; y <= currentYear; y++) years.push(y.toString());

      const hasAccounts =
        (db
          .prepare<
            [number],
            { cnt: number }
          >('SELECT COUNT(*) AS cnt FROM accounts WHERE user_id = ?')
          .get(userId)?.cnt ?? 0) > 0;

      if (!hasAccounts) return { account_types: [], data: [] };

      const CATEGORY_KEYS = [
        'prets',
        'liquidites',
        'epargne',
        'fonds_euros',
        'actions_uc',
      ] as const;
      type CategoryKey = (typeof CATEGORY_KEYS)[number];

      // Cash balance per account at year-end (amounts in cents). Calculé en deux
      // passes + cumul JS plutôt qu'une sous-requête corrélée par année × compte.
      const { accountRows, cashByYear } = buildCashByYear(db, userId, years, startYear);

      // Current market values (stock_positions × stock_prices) — used for current year only
      // price in stock_prices is in euros, same unit as price_per_share in stock_operations
      const currentMarketValues = marketValueByAccount(db, userId);

      // All stock operations sorted chronologically — fetched once for all years
      // price_per_share is stored in euros (not cents)
      const stockOps = db
        .prepare<
          [number],
          {
            account_id: number;
            ticker: string;
            type: string;
            quantity: number;
            price_per_share: number;
            date: string;
          }
        >(
          `SELECT account_id, ticker, type, quantity, price_per_share, date
           FROM stock_operations WHERE user_id = ? ORDER BY date, id`,
        )
        .all(userId);

      // Compute book value (qty × avg_price) per account up to a given year-end.
      const bookValuesAt = (yearEnd: string): Map<number, number> => {
        const pos = buildPositionsAt(stockOps, yearEnd);
        const result = new Map<number, number>();
        for (const [key, p] of pos) {
          if (p.qty <= 0) continue;
          const accountId = Number.parseInt(key.split(':')[0], 10);
          result.set(accountId, (result.get(accountId) ?? 0) + p.qty * p.avgPrice);
        }
        return result;
      };

      // All insurance operations sorted chronologically — amounts stored in cents
      const insuranceOps = db
        .prepare<
          [number],
          {
            account_id: number;
            support_type: string;
            op_type: string;
            amount: number;
            fees: number;
            social_fees: number;
            date: string;
          }
        >(
          `SELECT io.account_id, ins.type AS support_type, io.type AS op_type, io.amount, io.fees, io.social_fees, io.date
           FROM insurance_operations io
           JOIN insurance_supports ins ON io.support_id = ins.id
           WHERE io.user_id = ?
           ORDER BY io.date, io.id`,
        )
        .all(userId);

      const INSURANCE_POSITIVE_OPS = new Set([
        'versement',
        'arbitrage_in',
        'interets',
        'revalorisation',
      ]);

      // Cumulative euro/UC insurance values per account up to a given year-end (in cents).
      const insuranceValuesAt = (
        yearEnd: string,
      ): { euro: Map<number, number>; uc: Map<number, number> } => {
        const euro = new Map<number, number>();
        const uc = new Map<number, number>();
        for (const op of insuranceOps) {
          if (op.date > yearEnd) break;
          const gross = INSURANCE_POSITIVE_OPS.has(op.op_type) ? op.amount : -op.amount;
          const delta = gross - op.fees - op.social_fees;
          const map = op.support_type === 'euro' ? euro : uc;
          map.set(op.account_id, (map.get(op.account_id) ?? 0) + delta);
        }
        return { euro, uc };
      };

      // Loan data: principal (in cents) and paid installment principals (in cents)
      const loanData = db
        .prepare<
          [number],
          { account_id: number; principal_cents: number; loan_id: number; start_date: string }
        >(
          `SELECT account_id, principal_amount AS principal_cents, id AS loan_id, start_date
           FROM loans WHERE user_id = ?`,
        )
        .all(userId);

      type InstallmentRow = { loan_id: number; principal_cents: number; date: string };
      const installmentRows: InstallmentRow[] =
        loanData.length === 0
          ? []
          : db
              .prepare<[number], InstallmentRow>(
                `SELECT li.loan_id, li.principal_amount AS principal_cents, t.date
                 FROM loan_installments li
                 INNER JOIN transactions t ON t.id = li.transaction_id AND t.validated = 1
                 WHERE li.user_id = ?
                 ORDER BY t.date`,
              )
              .all(userId);

      // Capital restant dû per loan account at year-end (in euros, positive = remaining debt)
      const capitalRestantAt = (yearEnd: string): Map<number, number> => {
        const repaidMap = new Map<number, number>();
        for (const row of installmentRows) {
          if (row.date > yearEnd) break;
          repaidMap.set(row.loan_id, (repaidMap.get(row.loan_id) ?? 0) + row.principal_cents);
        }
        const result = new Map<number, number>();
        for (const loan of loanData) {
          if (loan.start_date > yearEnd) continue;
          const repaid = repaidMap.get(loan.loan_id) ?? 0;
          result.set(loan.account_id, toEuros(Math.max(0, loan.principal_cents - repaid)));
        }
        return result;
      };

      const data = years.map((year) => {
        const yearEnd = `${year}-12-31`;
        const isCurrentYear = Number.parseInt(year, 10) === currentYear;
        const cashAtYear = cashByYear.get(year)!;
        // Current year: use market value (matches dashboard "Solde total").
        // Past years: use book value (cost basis) since historical prices aren't stored.
        const stockValues = isCurrentYear ? currentMarketValues : bookValuesAt(yearEnd);
        const { euro: euroValues, uc: ucValues } = insuranceValuesAt(yearEnd);
        const capitalRestant = capitalRestantAt(yearEnd);

        const point: Record<CategoryKey, number> = {
          prets: 0,
          liquidites: 0,
          epargne: 0,
          fonds_euros: 0,
          actions_uc: 0,
        };

        for (const acc of accountRows) {
          const cashCents = cashAtYear.get(acc.account_id) ?? 0;
          if (acc.envelope_type === 'loan') {
            point.prets -= capitalRestant.get(acc.account_id) ?? 0;
          } else if (acc.envelope_type === 'investment') {
            point.liquidites += toEuros(cashCents);
            point.actions_uc += stockValues.get(acc.account_id) ?? 0;
          } else if (acc.envelope_type === 'life_insurance' || acc.envelope_type === 'per') {
            point.fonds_euros += toEuros(euroValues.get(acc.account_id) ?? 0);
            point.actions_uc += toEuros(ucValues.get(acc.account_id) ?? 0);
          } else if (acc.envelope_type === 'savings') {
            point.epargne += toEuros(cashCents);
          } else {
            point.liquidites += toEuros(cashCents);
          }
        }

        return point;
      });

      const labeledData = years.map((year, i) => ({
        year,
        ...(Object.fromEntries(
          (Object.keys(data[i]) as CategoryKey[]).map((k) => [k, data[i][k]]),
        ) as Record<string, number>),
      }));
      return { account_types: [...CATEGORY_KEYS], data: labeledData };
    },

    getProfitability: profitabilityRepo.getProfitability.bind(profitabilityRepo),
    getReportYears: reportRepo.getReportYears.bind(reportRepo),
    getReport: reportRepo.getReport.bind(reportRepo),
  };
}
