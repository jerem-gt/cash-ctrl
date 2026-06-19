import type { StockPosition } from '@cashctrl/types';
import { useTranslation } from 'react-i18next';

import { fmtCurrency, fmtStockPrice } from '@/lib/format';

import type { PositionMetrics } from '../lib/positionMetrics';

interface MetricCellProps {
  label: string;
  value: string;
  className?: string;
}

export function MetricCell({ label, value, className }: Readonly<MetricCellProps>) {
  return (
    <div>
      <p className="text-[10px] text-content-subtle uppercase tracking-wider mb-0.5">{label}</p>
      <p className={className ?? 'font-medium text-content-secondary tabular-nums'}>{value}</p>
    </div>
  );
}

interface PositionMetricCellsProps {
  pos: StockPosition;
  metrics: PositionMetrics;
  cellClassName?: string;
}

export function PositionMetricCells({
  pos,
  metrics,
  cellClassName,
}: Readonly<PositionMetricCellsProps>) {
  const { t } = useTranslation('portfolio');
  const valuation =
    metrics.marketValue == null ? '—' : fmtCurrency(metrics.marketValue, pos.currency);
  return (
    <>
      <MetricCell
        label={t('section.col_quantity')}
        value={String(pos.quantity)}
        className={cellClassName}
      />
      <MetricCell
        label={t('section.col_pru')}
        value={fmtStockPrice(pos.avg_price, pos.currency)}
        className={cellClassName}
      />
      <MetricCell
        label={t('section.col_price')}
        value={pos.current_price == null ? '—' : fmtStockPrice(pos.current_price, pos.currency)}
        className={cellClassName}
      />
      <MetricCell label={t('section.col_valuation')} value={valuation} className={cellClassName} />
    </>
  );
}

interface PnlBadgeProps {
  pnl: number | null;
  pnlPct: number | null;
  pnlColor: string;
  currency: string;
}

export function PnlBadge({ pnl, pnlPct, pnlColor, currency }: Readonly<PnlBadgeProps>) {
  if (pnl === null) return <p className="text-sm text-content-faint">—</p>;
  return (
    <div className="text-right">
      <p className={`text-sm font-bold tabular-nums ${pnlColor}`}>
        {pnl >= 0 ? '+' : ''}
        {fmtCurrency(pnl, currency)}
      </p>
      {pnlPct != null && (
        <p className={`text-[11px] tabular-nums ${pnlColor}`}>
          {pnlPct >= 0 ? '+' : ''}
          {pnlPct.toFixed(2)} %
        </p>
      )}
    </div>
  );
}

interface PositionActionsProps {
  pos: StockPosition;
  onBuy?: (pos: StockPosition) => void;
  onSell?: (pos: StockPosition) => void;
  onTransfer?: (pos: StockPosition) => void;
}

export function PositionActions({
  pos,
  onBuy,
  onSell,
  onTransfer,
}: Readonly<PositionActionsProps>) {
  const { t } = useTranslation('portfolio');
  if (!onBuy && !onSell && !onTransfer) return null;
  return (
    <div className="flex gap-1">
      {onBuy && (
        <button
          onClick={() => onBuy(pos)}
          className="text-[11px] font-bold text-success hover:text-success hover:bg-success-surface px-2 py-1 rounded-lg border border-success/30 transition-all"
          title={t('section.action_buy')}
        >
          {t('section.action_buy')}
        </button>
      )}
      {onSell && (
        <button
          onClick={() => onSell(pos)}
          className="text-[11px] font-bold text-danger hover:text-danger hover:bg-danger-surface px-2 py-1 rounded-lg border border-danger/30 transition-all"
          title={t('section.action_sell')}
        >
          {t('section.action_sell')}
        </button>
      )}
      {onTransfer && (
        <button
          onClick={() => onTransfer(pos)}
          className="text-[11px] font-bold text-info hover:text-info hover:bg-info-surface px-2 py-1 rounded-lg border border-info/30 transition-all"
          title={t('section.transfer_title')}
        >
          {t('section.action_transfer')}
        </button>
      )}
    </div>
  );
}
