import { toEuros } from '../../lib/money';

export interface YearlyReturn {
  year: string;
  start_value: number;
  end_value: number;
  net_flows: number;
  gain: number;
  return_pct: number | null;
  is_ytd: boolean;
}

export type DatedFlow = { date: string; signed_cents: number };

export type StockOp = {
  account_id: number;
  ticker: string;
  type: string;
  quantity: number;
  price_per_share: number;
  date: string;
};

export function getAllYears(openingDate: string, currentYear: number): string[] {
  const startYear = Number.parseInt(openingDate.slice(0, 4), 10);
  const years: string[] = [];
  for (let y = startYear; y <= currentYear; y++) years.push(y.toString());
  return years;
}

export function twrAnnualized(
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

export function modifiedDietzDenominator(
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

export function buildPositionsAt(
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

export function addToFlowMap(
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
export function groupByAccount<T extends { account_id: number }>(rows: T[]): Map<number, T[]> {
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
export function buildFlowsByAccountYear(
  rows: Array<{ account_id: number; date: string; signed_cents: number }>,
): Map<number, Map<string, DatedFlow[]>> {
  const map = new Map<number, Map<string, DatedFlow[]>>();
  for (const row of rows) addToFlowMap(map, row.account_id, row.date, row.signed_cents);
  return map;
}

/** Somme des deltas annuels strictement antérieurs à `startYear`. */
export function sumDeltasBefore(
  byYear: Map<string, number> | undefined,
  startYear: number,
): number {
  if (!byYear) return 0;
  let sum = 0;
  for (const [y, d] of byYear) {
    if (Number.parseInt(y, 10) < startYear) sum += d;
  }
  return sum;
}

export function buildYearlyReturn(
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

export function firstDayOfMonth(monthsBack: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1))
    .toISOString()
    .slice(0, 10);
}
