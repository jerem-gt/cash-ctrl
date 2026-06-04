import type { StockPosition } from '@/types';

export interface PositionMetrics {
  marketValue: number | null;
  costBasis: number;
  pnl: number | null;
  pnlPct: number | null;
  pnlColor: string;
}

export interface TotalMetrics {
  totalMarketValue: number;
  totalCostBasis: number;
  totalPnl: number;
  totalPnlPct: number;
  totalPnlColor: string;
}

export function getPnlColor(pnl: number | null): string {
  if (pnl === null) return 'text-content-subtle';
  if (pnl > 0) return 'text-success';
  if (pnl < 0) return 'text-danger';
  return 'text-content-muted';
}

export function getPositionMetrics(pos: StockPosition): PositionMetrics {
  const marketValue = pos.current_price == null ? null : pos.current_price * pos.quantity;
  const costBasis = pos.avg_price * pos.quantity;
  const pnl = marketValue == null ? null : marketValue - costBasis;
  const pnlPct = pnl != null && costBasis > 0 ? (pnl / costBasis) * 100 : null;
  return { marketValue, costBasis, pnl, pnlPct, pnlColor: getPnlColor(pnl) };
}

export function getTotalMetrics(positions: StockPosition[]): TotalMetrics {
  // Les positions sans cote (prix non encore récupéré, échec Yahoo) sont exclues
  // des DEUX côtés : sinon leur coût plomberait le P&L total d'une perte fantôme.
  const priced = positions.filter(
    (p): p is StockPosition & { current_price: number } => p.current_price != null,
  );
  let totalMarketValue = 0;
  let totalCostBasis = 0;
  for (const p of priced) {
    totalMarketValue += p.current_price * p.quantity;
    totalCostBasis += p.avg_price * p.quantity;
  }
  const totalPnl = totalMarketValue - totalCostBasis;
  const totalPnlPct = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0;
  return {
    totalMarketValue,
    totalCostBasis,
    totalPnl,
    totalPnlPct,
    totalPnlColor: getPnlColor(totalPnl),
  };
}
