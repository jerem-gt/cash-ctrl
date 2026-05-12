import type { Database } from 'better-sqlite3';

import { toEuros } from '../../lib/money';
import { parseSplits, TransactionRow, TX_WITH_DETAILS } from '../transactions/transactions.repo';
import type { Transaction } from '../transactions/transactions.types';

export interface MonthlyStat {
  month: string; // YYYY-MM
  income: number;
  expense: number;
}

export interface BalanceHistoryData {
  account_types: string[];
  data: Array<Record<string, string | number>>; // { year, [type]: balance }
}

export interface DashboardStats {
  month_income: number;
  month_expense: number;
  monthly: MonthlyStat[];
  expenses_by_category: Array<{ category: string; amount: number }>;
  recent: Transaction[];
  to_validate: Transaction[];
  upcoming: Transaction[];
}

function firstDayOfMonth(monthsBack: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1))
    .toISOString()
    .slice(0, 10);
}

export function createStatsRepo(db: Database) {
  return {
    getDashboardStats(userId: number, today: string): DashboardStats {
      const thisMonthStart = firstDayOfMonth(0);
      const nextMonthStart = firstDayOfMonth(-1);
      const sixMonthsStart = firstDayOfMonth(5);

      const metricsRow = db
        .prepare<[number, string, string], { income: number; expense: number }>(
          `SELECT
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense
          FROM transactions
          WHERE user_id = ? AND validated = 1 AND transfer_peer_id IS NULL
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
            AND date >= ? AND date < ?
          GROUP BY month
          ORDER BY month`,
        )
        .all(userId, sixMonthsStart, nextMonthStart);

      const monthMap = new Map(monthlyRows.map((r) => [r.month, r]));
      const monthly: MonthlyStat[] = Array.from({ length: 6 }, (_, i) => {
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
      const rawStart = firstYearRow?.year ? Number.parseInt(firstYearRow.year, 10) : currentYear;
      const startYear = Math.max(rawStart, currentYear - 9);

      const years: string[] = [];
      for (let y = startYear; y <= currentYear; y++) years.push(y.toString());

      const accountTypes = db
        .prepare<[number], { name: string }>(
          `SELECT DISTINCT COALESCE(at.name, 'Autre') AS name
           FROM accounts a
           LEFT JOIN account_types at ON a.account_type_id = at.id
           WHERE a.user_id = ?
           ORDER BY name`,
        )
        .all(userId)
        .map((r) => r.name);

      if (accountTypes.length === 0) return { account_types: [], data: [] };

      // Cash balance per account at year-end (amounts in cents)
      const cashStmt = db.prepare<
        { userId: number; yearEnd: string },
        { account_id: number; account_type: string; cash_cents: number }
      >(
        `SELECT
           a.id AS account_id,
           COALESCE(at.name, 'Autre') AS account_type,
           a.initial_balance + COALESCE((
             SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END)
             FROM transactions
             WHERE account_id = a.id AND validated = 1 AND date <= :yearEnd
           ), 0) AS cash_cents
         FROM accounts a
         LEFT JOIN account_types at ON a.account_type_id = at.id
         WHERE a.user_id = :userId`,
      );

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
      // Single pass through stockOps with early exit via sorted date ordering.
      const bookValuesAt = (yearEnd: string): Map<number, number> => {
        const pos = new Map<string, { qty: number; avgPrice: number }>();
        for (const op of stockOps) {
          if (op.date > yearEnd) break;
          const key = `${op.account_id}:${op.ticker}`;
          const p = pos.get(key) ?? { qty: 0, avgPrice: 0 };
          if (op.type === 'buy' || op.type === 'transfer_in') {
            const newQty = p.qty + op.quantity;
            p.avgPrice =
              newQty > 0 ? (p.qty * p.avgPrice + op.quantity * op.price_per_share) / newQty : 0;
            p.qty = newQty;
          } else {
            p.qty = Math.max(0, p.qty - op.quantity);
          }
          pos.set(key, p);
        }
        const result = new Map<number, number>();
        for (const [key, p] of pos) {
          if (p.qty <= 0) continue;
          const accountId = Number.parseInt(key.split(':')[0], 10);
          result.set(accountId, (result.get(accountId) ?? 0) + p.qty * p.avgPrice);
        }
        return result;
      };

      const data = years.map((year) => {
        const yearEnd = `${year}-12-31`;
        const cashRows = cashStmt.all({ userId, yearEnd });
        const bookValues = bookValuesAt(yearEnd);
        const point: Record<string, string | number> = { year };
        for (const type of accountTypes) point[type] = 0;
        for (const row of cashRows) {
          const total = toEuros(row.cash_cents) + (bookValues.get(row.account_id) ?? 0);
          point[row.account_type] = Number(point[row.account_type]) + total;
        }
        return point;
      });

      return { account_types: accountTypes, data };
    },
  };
}
