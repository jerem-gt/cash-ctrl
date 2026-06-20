import type { Database } from 'better-sqlite3';

import { toEuros } from '../../lib/money';
import type { AccountProfitability } from './profitability.types';
import {
  addToFlowMap,
  buildFlowsByAccountYear,
  buildPositionsAt,
  buildYearlyReturn,
  type DatedFlow,
  getAllYears,
  groupByAccount,
  type StockOp,
  twrAnnualized,
} from './stats.calculations';

export function marketValueByAccount(db: Database, userId: number): Map<number, number> {
  const rows = db
    .prepare<[number], { account_id: number; market_value: number }>(
      `SELECT sp.account_id, SUM(sp.quantity * COALESCE(sprice.price, 0)) AS market_value
       FROM stock_positions sp
       LEFT JOIN stock_prices sprice ON sp.ticker = sprice.ticker
       WHERE sp.user_id = ?
       GROUP BY sp.account_id`,
    )
    .all(userId);
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.account_id, r.market_value);
  return map;
}

export function computeInvestmentProfitability(
  db: Database,
  userId: number,
  currentYear: number,
  todayStr: string,
  financialIncomeCategoryId: number,
): AccountProfitability[] {
  type InvRow = {
    account_id: number;
    account_name: string;
    envelope_type: string;
    account_type: string;
    opening_date: string;
    initial_balance: number;
    deposits_cents: number;
    withdrawals_cents: number;
    cash_balance_cents: number;
  };
  type TxYearRow = {
    account_id: number;
    year: string;
    deposits_cents: number;
    withdrawals_cents: number;
    delta_cents: number;
  };

  const invAccounts = db
    .prepare<{ userId: number; finCatId: number }, InvRow>(
      `SELECT
         a.id AS account_id, a.name AS account_name,
         at.envelope_type, at.name AS account_type,
         COALESCE(a.opening_date, MIN(t.date), (SELECT MIN(so.date) FROM stock_operations so WHERE so.account_id = a.id)) AS opening_date, a.initial_balance,
         COALESCE(SUM(CASE WHEN t.type='income' AND (c.id IS NULL OR c.id != :finCatId) AND NOT EXISTS (SELECT 1 FROM stock_operations sox WHERE sox.transaction_id = t.id) AND t.validated=1 THEN t.amount ELSE 0 END),0) AS deposits_cents,
         COALESCE(SUM(CASE WHEN t.type='expense' AND t.transfer_peer_id IS NOT NULL AND t.validated=1 THEN t.amount ELSE 0 END),0) AS withdrawals_cents,
         a.initial_balance + COALESCE(SUM(CASE WHEN t.validated=1 THEN CASE WHEN t.type='income' THEN t.amount ELSE -t.amount END ELSE 0 END),0) AS cash_balance_cents
       FROM accounts a
       JOIN account_types at ON a.account_type_id = at.id
       LEFT JOIN transactions t ON t.account_id = a.id
       LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
       LEFT JOIN categories c ON sc.category_id = c.id
       WHERE a.user_id = :userId AND at.envelope_type = 'investment' AND a.closed_at IS NULL
       GROUP BY a.id, a.name, at.envelope_type, at.name, a.initial_balance`,
    )
    .all({ userId, finCatId: financialIncomeCategoryId });

  const currentStockValues = marketValueByAccount(db, userId);

  const allStockOps = db
    .prepare<[number], StockOp>(
      `SELECT so.account_id, so.ticker, so.type, so.quantity, so.price_per_share, so.date
       FROM stock_operations so
       JOIN accounts a ON a.id = so.account_id
       WHERE a.user_id = ?
       ORDER BY so.date, so.id`,
    )
    .all(userId);

  // Sorted ASC by date so we can find the closest price on or before a target date.
  // December 31 is often a non-trading day (weekend/holiday), so exact lookups would
  // silently fall back to avgPrice and hide any unrealized gain/loss.
  const priceHistoryMap = new Map<string, Array<{ date: string; price: number }>>();
  for (const row of db
    .prepare<[number], { ticker: string; date: string; price: number }>(
      `SELECT ticker, date, price FROM stock_price_history
       WHERE ticker IN (
         SELECT DISTINCT so.ticker FROM stock_operations so
         JOIN accounts a ON a.id = so.account_id
         WHERE a.user_id = ?
       )
       ORDER BY ticker, date`,
    )
    .all(userId)) {
    if (!priceHistoryMap.has(row.ticker)) priceHistoryMap.set(row.ticker, []);
    priceHistoryMap.get(row.ticker)!.push({ date: row.date, price: row.price });
  }

  const closestPriceAt = (ticker: string, targetDate: string): number | undefined => {
    const history = priceHistoryMap.get(ticker);
    if (!history) return undefined;
    let best: number | undefined;
    for (const entry of history) {
      if (entry.date > targetDate) break;
      best = entry.price;
    }
    return best;
  };

  const positionsAt = (yearEnd: string) => buildPositionsAt(allStockOps, yearEnd);

  const stockValueAt = (
    accountId: number,
    yearEnd: string,
    positions: Map<string, { qty: number; avgPrice: number }>,
  ): number => {
    let total = 0;
    for (const [key, p] of positions) {
      if (!key.startsWith(`${accountId}:`)) continue;
      if (p.qty <= 0) continue;
      const ticker = key.split(':')[1];
      const price = closestPriceAt(ticker, yearEnd) ?? p.avgPrice;
      total += p.qty * price;
    }
    return total;
  };

  const invYearlyByAccount = groupByAccount(
    db
      .prepare<{ userId: number; finCatId: number }, TxYearRow>(
        `SELECT
         t.account_id,
         strftime('%Y', t.date) AS year,
         COALESCE(SUM(CASE WHEN t.type='income' AND (c.id IS NULL OR c.id != :finCatId) AND NOT EXISTS (SELECT 1 FROM stock_operations sox WHERE sox.transaction_id = t.id) AND t.validated=1 THEN t.amount ELSE 0 END),0) AS deposits_cents,
         COALESCE(SUM(CASE WHEN t.type='expense' AND t.transfer_peer_id IS NOT NULL AND t.validated=1 THEN t.amount ELSE 0 END),0) AS withdrawals_cents,
         COALESCE(SUM(CASE WHEN t.validated=1 THEN CASE WHEN t.type='income' THEN t.amount ELSE -t.amount END ELSE 0 END),0) AS delta_cents
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       JOIN account_types at ON a.account_type_id = at.id
       LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
       LEFT JOIN categories c ON sc.category_id = c.id
       WHERE a.user_id = :userId AND at.envelope_type = 'investment' AND a.closed_at IS NULL
       GROUP BY t.account_id, year
       ORDER BY t.account_id, year`,
      )
      .all({ userId, finCatId: financialIncomeCategoryId }),
  );

  const invFlowsByAccountYear = buildFlowsByAccountYear(
    db
      .prepare<
        { userId: number; finCatId: number },
        { account_id: number; date: string; signed_cents: number }
      >(
        `SELECT t.account_id, t.date,
         CASE WHEN t.type='income' THEN t.amount ELSE -t.amount END AS signed_cents
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       JOIN account_types at ON a.account_type_id = at.id
       LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
       LEFT JOIN categories c ON sc.category_id = c.id
       WHERE a.user_id = :userId AND at.envelope_type = 'investment' AND a.closed_at IS NULL
         AND t.validated = 1
         AND (
           (t.type = 'income' AND (c.id IS NULL OR c.id != :finCatId) AND NOT EXISTS (SELECT 1 FROM stock_operations sox WHERE sox.transaction_id = t.id))
           OR (t.type = 'expense' AND t.transfer_peer_id IS NOT NULL)
         )
       ORDER BY t.account_id, t.date`,
      )
      .all({ userId, finCatId: financialIncomeCategoryId }),
  );

  const stockTransferTotals = new Map<number, { in: number; out: number }>();
  for (const row of db
    .prepare<[number], { account_id: number; date: string; signed_cents: number }>(
      `SELECT so.account_id, so.date,
         ROUND(CASE WHEN so.type='transfer_in'
           THEN so.quantity * so.price_per_share * 100
           ELSE -(so.quantity * so.price_per_share * 100) END) AS signed_cents
       FROM stock_operations so
       JOIN accounts a ON a.id = so.account_id
       JOIN account_types at ON a.account_type_id = at.id
       WHERE a.user_id = ? AND at.envelope_type = 'investment' AND a.closed_at IS NULL
         AND so.type IN ('transfer_in','transfer_out')
       ORDER BY so.account_id, so.date`,
    )
    .all(userId)) {
    addToFlowMap(invFlowsByAccountYear, row.account_id, row.date, row.signed_cents);
    const t = stockTransferTotals.get(row.account_id) ?? { in: 0, out: 0 };
    if (row.signed_cents >= 0) {
      t.in += row.signed_cents;
    } else {
      t.out += -row.signed_cents;
    }
    stockTransferTotals.set(row.account_id, t);
  }

  return invAccounts
    .filter((acc) => acc.opening_date != null)
    .map((acc) => {
      const transfers = stockTransferTotals.get(acc.account_id) ?? { in: 0, out: 0 };
      const capitalInvesti = toEuros(
        acc.initial_balance +
          acc.deposits_cents -
          acc.withdrawals_cents +
          transfers.in -
          transfers.out,
      );
      const currentStocks = currentStockValues.get(acc.account_id) ?? 0;
      const currentCash = toEuros(acc.cash_balance_cents);
      const valeurActuelle = currentCash + currentStocks;
      const plusValue = valeurActuelle - capitalInvesti;
      const rendementTotalPct = capitalInvesti > 0 ? (plusValue / capitalInvesti) * 100 : 0;

      const years = getAllYears(acc.opening_date, currentYear);
      const yearlyRowMap = new Map(
        (invYearlyByAccount.get(acc.account_id) ?? []).map((r) => [r.year, r]),
      );
      const yearly_returns = [];
      let runningCash = 0;
      let prevStockValue = 0;

      for (const year of years) {
        const yearEnd = `${year}-12-31`;
        const isCurrentYear = Number.parseInt(year, 10) === currentYear;
        const isFirstYear = year === years[0];
        const row = yearlyRowMap.get(year);

        const start_value = runningCash + prevStockValue;
        const yearCashFlows = invFlowsByAccountYear.get(acc.account_id)?.get(year) ?? [];
        const yearFlows: DatedFlow[] =
          isFirstYear && acc.initial_balance !== 0
            ? [{ date: acc.opening_date, signed_cents: acc.initial_balance }, ...yearCashFlows]
            : yearCashFlows;
        const netFlows = yearFlows.reduce((s, f) => s + toEuros(f.signed_cents), 0);
        runningCash +=
          (isFirstYear ? toEuros(acc.initial_balance) : 0) + (row ? toEuros(row.delta_cents) : 0);

        const stockValue = isCurrentYear
          ? (currentStockValues.get(acc.account_id) ?? 0)
          : stockValueAt(acc.account_id, yearEnd, positionsAt(yearEnd));

        const end_value = runningCash + stockValue;
        yearly_returns.push(
          buildYearlyReturn(
            year,
            start_value,
            end_value,
            netFlows,
            yearFlows,
            isCurrentYear,
            todayStr,
          ),
        );

        prevStockValue = stockValue;
      }

      return {
        account_id: acc.account_id,
        account_name: acc.account_name,
        envelope_type: acc.envelope_type,
        account_type: acc.account_type,
        opening_date: acc.opening_date,
        capital_investi: capitalInvesti,
        capital_retire: toEuros(acc.withdrawals_cents + transfers.out),
        valeur_actuelle: valeurActuelle,
        plus_value_absolue: plusValue,
        rendement_total_pct: rendementTotalPct,
        rendement_annualise_pct: twrAnnualized(yearly_returns, acc.opening_date),
        yearly_returns,
      };
    });
}
