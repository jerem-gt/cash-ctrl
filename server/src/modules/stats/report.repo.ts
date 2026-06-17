import type { Database } from 'better-sqlite3';

import { toEuros } from '../../lib/money';

export interface MonthlyStat {
  month: string; // YYYY-MM
  income: number;
  expense: number;
}

export interface ReportData {
  income_total: number;
  expense_total: number;
  monthly: MonthlyStat[];
  expense_by_category: Array<{ category: string; amount: number }>;
  income_by_category: Array<{ category: string; amount: number }>;
}

export function createReportRepo(db: Database) {
  return {
    getReportYears(userId: number): number[] {
      return db
        .prepare<[number], { year: number }>(
          `SELECT DISTINCT CAST(strftime('%Y', date) AS INTEGER) AS year
           FROM transactions
           WHERE user_id = ? AND validated = 1
           ORDER BY year DESC`,
        )
        .all(userId)
        .map((r) => r.year);
    },

    getReport(userId: number, year: number, accountId?: number): ReportData {
      const dateFrom = `${year}-01-01`;
      const dateTo = `${year}-12-31`;
      // accountCond placed AFTER date params so params order is always [userId, dateFrom, dateTo, (accountId?)]
      const accountCond = accountId == null ? '' : 'AND t.account_id = ?';
      const insExcl = `AND t.id NOT IN (
        SELECT transaction_id FROM insurance_operations WHERE transaction_id IS NOT NULL
      )`;
      const stockExcl = `AND t.id NOT IN (
        SELECT transaction_id FROM stock_operations WHERE transaction_id IS NOT NULL
      )`;
      const baseParams: unknown[] = [userId, dateFrom, dateTo];
      const filterParams: unknown[] = accountId == null ? baseParams : [...baseParams, accountId];

      const totals = db
        .prepare<unknown[], { income: number; expense: number }>(
          `SELECT
            SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS income,
            SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS expense
           FROM transactions t
           WHERE t.user_id = ? AND t.validated = 1 AND t.transfer_peer_id IS NULL
             ${insExcl} ${stockExcl}
             AND t.date >= ? AND t.date <= ? ${accountCond}`,
        )
        .get(...filterParams) ?? { income: 0, expense: 0 };

      const monthlyRows = db
        .prepare<unknown[], { month: string; income: number; expense: number }>(
          `SELECT
            strftime('%Y-%m', t.date) AS month,
            SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS income,
            SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS expense
           FROM transactions t
           WHERE t.user_id = ? AND t.validated = 1 AND t.transfer_peer_id IS NULL
             ${insExcl} ${stockExcl}
             AND t.date >= ? AND t.date <= ? ${accountCond}
           GROUP BY month
           ORDER BY month`,
        )
        .all(...filterParams);

      const monthMap = new Map(monthlyRows.map((r) => [r.month, r]));
      const monthly: MonthlyStat[] = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const month = `${year}-${String(m).padStart(2, '0')}`;
        const row = monthMap.get(month);
        return {
          month,
          income: toEuros(row?.income ?? 0),
          expense: toEuros(row?.expense ?? 0),
        };
      });

      const expenseByCat = db
        .prepare<unknown[], { category: string; amount: number }>(
          `SELECT COALESCE(c.name, '') AS category, SUM(t.amount) AS amount
           FROM transactions t
           LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
           LEFT JOIN categories c ON sc.category_id = c.id
           WHERE t.user_id = ? AND t.validated = 1 AND t.transfer_peer_id IS NULL
             ${insExcl} ${stockExcl}
             AND t.type = 'expense'
             AND t.date >= ? AND t.date <= ? ${accountCond}
           GROUP BY category
           ORDER BY amount DESC`,
        )
        .all(...filterParams);

      const incomeByCat = db
        .prepare<unknown[], { category: string; amount: number }>(
          `SELECT COALESCE(c.name, '') AS category, SUM(t.amount) AS amount
           FROM transactions t
           LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
           LEFT JOIN categories c ON sc.category_id = c.id
           WHERE t.user_id = ? AND t.validated = 1 AND t.transfer_peer_id IS NULL
             ${insExcl} ${stockExcl}
             AND t.type = 'income'
             AND t.date >= ? AND t.date <= ? ${accountCond}
           GROUP BY category
           ORDER BY amount DESC`,
        )
        .all(...filterParams);

      return {
        income_total: toEuros(totals.income),
        expense_total: toEuros(totals.expense),
        monthly,
        expense_by_category: expenseByCat.map((r) => ({ ...r, amount: toEuros(r.amount) })),
        income_by_category: incomeByCat.map((r) => ({ ...r, amount: toEuros(r.amount) })),
      };
    },
  };
}
