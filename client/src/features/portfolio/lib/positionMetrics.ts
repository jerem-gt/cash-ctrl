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
  if (pnl == null) return 'text-stone-400';
  if (pnl > 0) return 'text-green-700';
  if (pnl < 0) return 'text-red-700';
  return 'text-stone-500';
}

export function getPositionMetrics(pos: StockPosition): PositionMetrics {
  const marketValue = pos.current_price == null ? null : pos.current_price * pos.quantity;
  const costBasis = pos.avg_price * pos.quantity;
  const pnl = marketValue == null ? null : marketValue - costBasis;
  const pnlPct = pnl != null && costBasis > 0 ? (pnl / costBasis) * 100 : null;
  return { marketValue, costBasis, pnl, pnlPct, pnlColor: getPnlColor(pnl) };
}

export function getTotalMetrics(positions: StockPosition[]): TotalMetrics {
  const totalMarketValue = positions.reduce(
    (sum, p) => sum + (p.current_price == null ? 0 : p.current_price * p.quantity),
    0,
  );
  const totalCostBasis = positions.reduce((sum, p) => sum + p.avg_price * p.quantity, 0);
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
