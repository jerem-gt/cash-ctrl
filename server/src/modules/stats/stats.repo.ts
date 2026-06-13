import type { Database } from 'better-sqlite3';

import { toEuros } from '../../lib/money';
import { createSettingsRepo } from '../settings/settings.repo';
import { parseSplits, TransactionRow, TX_WITH_DETAILS } from '../transactions/transactions.repo';
import type { Transaction } from '../transactions/transactions.types';

export interface YearlyReturn {
  year: string;
  start_value: number;
  end_value: number;
  net_flows: number;
  gain: number;
  return_pct: number | null;
  is_ytd: boolean;
}

export interface AccountProfitability {
  account_id: number;
  account_name: string;
  envelope_type: string | null;
  account_type: string;
  opening_date: string;
  capital_investi: number;
  capital_retire: number;
  valeur_actuelle: number;
  plus_value_absolue: number;
  rendement_total_pct: number;
  rendement_annualise_pct: number | null;
  yearly_returns: YearlyReturn[];
}

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

function getAllYears(openingDate: string, currentYear: number): string[] {
  const startYear = Number.parseInt(openingDate.slice(0, 4), 10);
  const years: string[] = [];
  for (let y = startYear; y <= currentYear; y++) years.push(y.toString());
  return years;
}

function twrAnnualized(
  yearlyReturns: YearlyReturn[],
  openingDate: string,
  excludeYtd = false,
): number | null {
  const returns = excludeYtd ? yearlyReturns.filter((yr) => !yr.is_ytd) : yearlyReturns;
  if (returns.length === 0) return null;
  let endMs: number;
  if (excludeYtd) {
    const lastYear = returns.at(-1)!.year;
    endMs = new Date(`${lastYear}-12-31`).getTime();
  } else {
    endMs = Date.now();
  }
  const years = (endMs - new Date(openingDate).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (years < 0.5) return null;
  const twr =
    returns.reduce((prod, yr) => {
      return yr.return_pct === null ? prod : prod * (1 + yr.return_pct / 100);
    }, 1) - 1;
  if (twr <= -1) return null;
  return (Math.pow(1 + twr, 1 / years) - 1) * 100;
}

type DatedFlow = { date: string; signed_cents: number };

function modifiedDietzDenominator(
  startValue: number,
  flows: DatedFlow[],
  yearStart: string,
  yearEnd: string,
): number {
  const startMs = new Date(yearStart).getTime();
  const endMs = new Date(yearEnd).getTime();
  const periodDays = (endMs - startMs) / 86_400_000;
  if (periodDays <= 0) return startValue;
  let weightedFlows = 0;
  for (const flow of flows) {
    const daysFromStart = Math.max(
      0,
      Math.min(periodDays, (new Date(flow.date).getTime() - startMs) / 86_400_000),
    );
    const weight = (periodDays - daysFromStart) / periodDays;
    weightedFlows += weight * toEuros(flow.signed_cents);
  }
  return startValue + weightedFlows;
}

type StockOp = {
  account_id: number;
  ticker: string;
  type: string;
  quantity: number;
  price_per_share: number;
  date: string;
};

function buildPositionsAt(
  ops: StockOp[],
  yearEnd: string,
): Map<string, { qty: number; avgPrice: number }> {
  const pos = new Map<string, { qty: number; avgPrice: number }>();
  for (const op of ops) {
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
  return pos;
}

function addToFlowMap(
  map: Map<number, Map<string, DatedFlow[]>>,
  accountId: number,
  date: string,
  signed_cents: number,
): void {
  const year = date.slice(0, 4);
  if (!map.has(accountId)) map.set(accountId, new Map());
  const byYear = map.get(accountId)!;
  if (!byYear.has(year)) byYear.set(year, []);
  byYear.get(year)!.push({ date, signed_cents });
}

/** Regroupe des lignes annuelles par account_id en préservant leur ordre. */
function groupByAccount<T extends { account_id: number }>(rows: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const row of rows) {
    const list = map.get(row.account_id);
    if (list) {
      list.push(row);
    } else {
      map.set(row.account_id, [row]);
    }
  }
  return map;
}

/** Construit la map account → année → flux datés à partir de lignes (date, montant signé). */
function buildFlowsByAccountYear(
  rows: Array<{ account_id: number; date: string; signed_cents: number }>,
): Map<number, Map<string, DatedFlow[]>> {
  const map = new Map<number, Map<string, DatedFlow[]>>();
  for (const row of rows) addToFlowMap(map, row.account_id, row.date, row.signed_cents);
  return map;
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

/** Somme des deltas annuels strictement antérieurs à `startYear`. */
function sumDeltasBefore(byYear: Map<string, number> | undefined, startYear: number): number {
  if (!byYear) return 0;
  let sum = 0;
  for (const [y, d] of byYear) {
    if (Number.parseInt(y, 10) < startYear) sum += d;
  }
  return sum;
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

/** Valeur de marché courante (positions × cote) par compte, en euros. */
function marketValueByAccount(db: Database, userId: number): Map<number, number> {
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

function buildYearlyReturn(
  year: string,
  start_value: number,
  end_value: number,
  netFlows: number,
  yearFlows: DatedFlow[],
  isCurrentYear: boolean,
  todayStr: string,
): YearlyReturn {
  const gain = end_value - start_value - netFlows;
  const periodEnd = isCurrentYear ? todayStr : `${year}-12-31`;
  const dietzDenominator = modifiedDietzDenominator(
    start_value,
    yearFlows,
    `${year}-01-01`,
    periodEnd,
  );
  const return_pct = dietzDenominator > 0 ? (gain / dietzDenominator) * 100 : null;
  return {
    year,
    start_value,
    end_value,
    net_flows: netFlows,
    gain,
    return_pct,
    is_ytd: isCurrentYear,
  };
}

function computeInvestmentProfitability(
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

  const priceHistoryMap = new Map<string, Map<string, number>>();
  for (const row of db
    .prepare<[number], { ticker: string; date: string; price: number }>(
      `SELECT ticker, date, price FROM stock_price_history
       WHERE ticker IN (
         SELECT DISTINCT so.ticker FROM stock_operations so
         JOIN accounts a ON a.id = so.account_id
         WHERE a.user_id = ?
       )`,
    )
    .all(userId)) {
    if (!priceHistoryMap.has(row.ticker)) priceHistoryMap.set(row.ticker, new Map());
    priceHistoryMap.get(row.ticker)!.set(row.date, row.price);
  }

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
      const price = priceHistoryMap.get(ticker)?.get(yearEnd) ?? p.avgPrice;
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
      const yearly_returns: YearlyReturn[] = [];
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

function computeInsuranceProfitability(
  db: Database,
  userId: number,
  currentYear: number,
  todayStr: string,
): AccountProfitability[] {
  type InsRow = {
    account_id: number;
    account_name: string;
    envelope_type: string;
    account_type: string;
    opening_date: string;
    versements_cents: number;
    rachats_cents: number;
    balance_eur: number;
  };
  type InsYearRow = {
    account_id: number;
    year: string;
    versements_cents: number;
    rachats_cents: number;
    delta_cents: number;
  };

  const insAccounts = db
    .prepare<[number], InsRow>(
      `SELECT
         a.id AS account_id, a.name AS account_name,
         at.envelope_type, at.name AS account_type,
         COALESCE(a.opening_date, MIN(io.date)) AS opening_date,
         COALESCE(SUM(CASE WHEN io.type='versement' THEN io.amount ELSE 0 END),0) AS versements_cents,
         COALESCE(SUM(CASE WHEN io.type='rachat' THEN io.amount ELSE 0 END),0) AS rachats_cents,
         COALESCE(SUM(
           (CASE WHEN io.type IN ('versement','arbitrage_in','interets','revalorisation')
                 THEN io.amount ELSE -io.amount END) - io.fees - io.social_fees
         ),0) * 1.0 / 100 AS balance_eur
       FROM accounts a
       JOIN account_types at ON a.account_type_id = at.id
       LEFT JOIN insurance_operations io ON io.account_id = a.id
       WHERE a.user_id = ? AND at.envelope_type IN ('life_insurance','per') AND a.closed_at IS NULL
       GROUP BY a.id, a.name, at.envelope_type, at.name`,
    )
    .all(userId);

  const insYearlyByAccount = groupByAccount(
    db
      .prepare<[number], InsYearRow>(
        `SELECT
         io.account_id,
         strftime('%Y', io.date) AS year,
         COALESCE(SUM(CASE WHEN io.type='versement' THEN io.amount ELSE 0 END),0) AS versements_cents,
         COALESCE(SUM(CASE WHEN io.type='rachat' THEN io.amount ELSE 0 END),0) AS rachats_cents,
         COALESCE(SUM(
           (CASE WHEN io.type IN ('versement','arbitrage_in','interets','revalorisation')
                 THEN io.amount ELSE -io.amount END) - io.fees - io.social_fees
         ),0) AS delta_cents
       FROM insurance_operations io
       JOIN accounts a ON a.id = io.account_id
       WHERE a.user_id = ? AND a.closed_at IS NULL
       GROUP BY io.account_id, year
       ORDER BY io.account_id, year`,
      )
      .all(userId),
  );

  const insFlowsByAccountYear = buildFlowsByAccountYear(
    db
      .prepare<[number], { account_id: number; date: string; signed_cents: number }>(
        `SELECT io.account_id, io.date,
         CASE WHEN io.type='versement' THEN io.amount ELSE -io.amount END AS signed_cents
       FROM insurance_operations io
       JOIN accounts a ON a.id = io.account_id
       WHERE a.user_id = ? AND a.closed_at IS NULL
         AND io.type IN ('versement','rachat')
       ORDER BY io.account_id, io.date`,
      )
      .all(userId),
  );

  return insAccounts
    .filter((acc) => acc.opening_date != null)
    .map((acc) => {
      const capitalInvesti = toEuros(acc.versements_cents);
      const capitalRetire = toEuros(acc.rachats_cents);
      const valeurActuelle = acc.balance_eur;
      const plusValue = valeurActuelle + capitalRetire - capitalInvesti;
      const rendementTotalPct = capitalInvesti > 0 ? (plusValue / capitalInvesti) * 100 : 0;

      const years = getAllYears(acc.opening_date, currentYear);
      const yearlyRowMap = new Map(
        (insYearlyByAccount.get(acc.account_id) ?? []).map((r) => [r.year, r]),
      );
      const yearly_returns: YearlyReturn[] = [];
      let runningBalance = 0;

      for (const year of years) {
        const isCurrentYear = Number.parseInt(year, 10) === currentYear;
        const row = yearlyRowMap.get(year);

        const start_value = runningBalance;
        const netFlows = row ? toEuros(row.versements_cents - row.rachats_cents) : 0;
        const delta = row ? toEuros(row.delta_cents) : 0;
        const end_value = isCurrentYear ? valeurActuelle : runningBalance + delta;
        const yearFlows = insFlowsByAccountYear.get(acc.account_id)?.get(year) ?? [];
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

        runningBalance = end_value;
      }

      return {
        account_id: acc.account_id,
        account_name: acc.account_name,
        envelope_type: acc.envelope_type,
        account_type: acc.account_type,
        opening_date: acc.opening_date,
        capital_investi: capitalInvesti,
        capital_retire: capitalRetire,
        valeur_actuelle: valeurActuelle,
        plus_value_absolue: plusValue,
        rendement_total_pct: rendementTotalPct,
        rendement_annualise_pct: twrAnnualized(yearly_returns, acc.opening_date, true),
        yearly_returns,
      };
    });
}

function computeSavingsProfitability(
  db: Database,
  userId: number,
  currentYear: number,
  todayStr: string,
  financialIncomeCategoryId: number,
): AccountProfitability[] {
  type SavRow = {
    account_id: number;
    account_name: string;
    envelope_type: string | null;
    account_type: string;
    opening_date: string;
    initial_balance: number;
    deposits_cents: number;
    withdrawals_cents: number;
    balance_cents: number;
  };
  type SavYearRow = {
    account_id: number;
    year: string;
    deposits_cents: number;
    withdrawals_cents: number;
    delta_cents: number;
  };

  const savAccounts = db
    .prepare<{ userId: number; finCatId: number }, SavRow>(
      `SELECT
         a.id AS account_id, a.name AS account_name,
         at.envelope_type, at.name AS account_type,
         COALESCE(a.opening_date, MIN(t.date)) AS opening_date, a.initial_balance,
         COALESCE(SUM(CASE WHEN t.type='income' AND (c.id IS NULL OR c.id != :finCatId) AND t.validated=1 THEN t.amount ELSE 0 END),0) AS deposits_cents,
         COALESCE(SUM(CASE WHEN t.type='expense' AND t.transfer_peer_id IS NOT NULL AND t.validated=1 THEN t.amount ELSE 0 END),0) AS withdrawals_cents,
         a.initial_balance + COALESCE(SUM(CASE WHEN t.validated=1 THEN CASE WHEN t.type='income' THEN t.amount ELSE -t.amount END ELSE 0 END),0) AS balance_cents
       FROM accounts a
       JOIN account_types at ON a.account_type_id = at.id
       LEFT JOIN transactions t ON t.account_id = a.id
       LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
       LEFT JOIN categories c ON sc.category_id = c.id
       WHERE a.user_id = :userId AND at.envelope_type = 'savings' AND a.closed_at IS NULL
       GROUP BY a.id, a.name, at.envelope_type, at.name, a.initial_balance`,
    )
    .all({ userId, finCatId: financialIncomeCategoryId });

  const savYearlyByAccount = groupByAccount(
    db
      .prepare<{ userId: number; finCatId: number }, SavYearRow>(
        `SELECT
         t.account_id,
         strftime('%Y', t.date) AS year,
         COALESCE(SUM(CASE WHEN t.type='income' AND (c.id IS NULL OR c.id != :finCatId) AND t.validated=1 THEN t.amount ELSE 0 END),0) AS deposits_cents,
         COALESCE(SUM(CASE WHEN t.type='expense' AND t.transfer_peer_id IS NOT NULL AND t.validated=1 THEN t.amount ELSE 0 END),0) AS withdrawals_cents,
         COALESCE(SUM(CASE WHEN t.validated=1 THEN CASE WHEN t.type='income' THEN t.amount ELSE -t.amount END ELSE 0 END),0) AS delta_cents
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       JOIN account_types at ON a.account_type_id = at.id
       LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
       LEFT JOIN categories c ON sc.category_id = c.id
       WHERE a.user_id = :userId AND at.envelope_type = 'savings' AND a.closed_at IS NULL
       GROUP BY t.account_id, year
       ORDER BY t.account_id, year`,
      )
      .all({ userId, finCatId: financialIncomeCategoryId }),
  );

  const savFlowsByAccountYear = buildFlowsByAccountYear(
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
       WHERE a.user_id = :userId AND at.envelope_type = 'savings' AND a.closed_at IS NULL
         AND t.validated = 1
         AND (
           (t.type = 'income' AND (c.id IS NULL OR c.id != :finCatId))
           OR (t.type = 'expense' AND t.transfer_peer_id IS NOT NULL)
         )
       ORDER BY t.account_id, t.date`,
      )
      .all({ userId, finCatId: financialIncomeCategoryId }),
  );

  return savAccounts
    .filter((acc) => acc.opening_date != null)
    .map((acc) => {
      const capitalInvesti = toEuros(
        acc.initial_balance + acc.deposits_cents - acc.withdrawals_cents,
      );
      const valeurActuelle = toEuros(acc.balance_cents);
      const plusValue = valeurActuelle - capitalInvesti;
      const rendementTotalPct = capitalInvesti > 0 ? (plusValue / capitalInvesti) * 100 : 0;

      const years = getAllYears(acc.opening_date, currentYear);
      const yearlyRowMap = new Map(
        (savYearlyByAccount.get(acc.account_id) ?? []).map((r) => [r.year, r]),
      );
      const yearly_returns: YearlyReturn[] = [];
      let runningBalance = 0;

      for (const year of years) {
        const isCurrentYear = Number.parseInt(year, 10) === currentYear;
        const isFirstYear = year === years[0];
        const row = yearlyRowMap.get(year);

        const start_value = runningBalance;
        const yearCashFlows = savFlowsByAccountYear.get(acc.account_id)?.get(year) ?? [];
        const yearFlows: DatedFlow[] =
          isFirstYear && acc.initial_balance !== 0
            ? [{ date: acc.opening_date, signed_cents: acc.initial_balance }, ...yearCashFlows]
            : yearCashFlows;
        const netFlows = yearFlows.reduce((s, f) => s + toEuros(f.signed_cents), 0);
        const economicEnd =
          runningBalance +
          (isFirstYear ? toEuros(acc.initial_balance) : 0) +
          (row ? toEuros(row.delta_cents) : 0);
        const end_value = isCurrentYear ? valeurActuelle : economicEnd;
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

        runningBalance = economicEnd;
      }

      return {
        account_id: acc.account_id,
        account_name: acc.account_name,
        envelope_type: acc.envelope_type,
        account_type: acc.account_type,
        opening_date: acc.opening_date,
        capital_investi: capitalInvesti,
        capital_retire: toEuros(acc.withdrawals_cents),
        valeur_actuelle: valeurActuelle,
        plus_value_absolue: plusValue,
        rendement_total_pct: rendementTotalPct,
        rendement_annualise_pct: twrAnnualized(yearly_returns, acc.opening_date, true),
        yearly_returns,
      };
    });
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
      const rawStart = firstYearRow?.year ? Number.parseInt(firstYearRow.year, 10) : currentYear;
      const startYear = Math.max(rawStart, currentYear - 9);

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
        .prepare<[number], { account_id: number; principal_cents: number; loan_id: number }>(
          `SELECT account_id, principal_amount AS principal_cents, id AS loan_id
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

    getProfitability(userId: number): AccountProfitability[] {
      const currentYear = new Date().getUTCFullYear();
      const todayStr = new Date().toISOString().slice(0, 10);
      // Read financial income category id once; use -1 (matches nothing) if unset
      const settings = createSettingsRepo(db).get(userId);
      const financialIncomeCategoryId = settings.financial_income_category_id ?? -1;
      return [
        ...computeInvestmentProfitability(
          db,
          userId,
          currentYear,
          todayStr,
          financialIncomeCategoryId,
        ),
        ...computeInsuranceProfitability(db, userId, currentYear, todayStr),
        ...computeSavingsProfitability(
          db,
          userId,
          currentYear,
          todayStr,
          financialIncomeCategoryId,
        ),
      ];
    },
  };
}
