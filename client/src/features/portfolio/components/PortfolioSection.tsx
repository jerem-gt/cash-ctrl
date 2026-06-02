import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, showToast, Spinner } from '@/components/ui';
import {
  PnlBadge,
  PositionActions,
  PositionMetricCells,
} from '@/features/portfolio/components/PositionRowParts';
import { StockOperationModal } from '@/features/portfolio/components/StockOperationModal';
import { TransferStockModal } from '@/features/portfolio/components/TransferStockModal';
import { useRefreshPrices, useStockPositions } from '@/features/portfolio/hooks/useStocks';
import { getPositionMetrics, getTotalMetrics } from '@/features/portfolio/lib/positionMetrics';
import { fmtDec } from '@/lib/format';
import type { StockPosition } from '@/types';

interface PositionRowProps {
  pos: StockPosition;
  onBuy?: (pos: StockPosition) => void;
  onSell?: (pos: StockPosition) => void;
  onTransfer?: (pos: StockPosition) => void;
}

function PositionTicker({ pos, lineClamp }: Readonly<{ pos: StockPosition; lineClamp?: boolean }>) {
  return (
    <>
      <span className="text-sm font-bold text-content font-mono">{pos.ticker}</span>
      {pos.name && (
        <p
          className={`text-[10px] text-content-subtle mt-0.5 ${lineClamp ? 'line-clamp-2' : 'truncate'}`}
          title={pos.name}
        >
          {pos.name}
        </p>
      )}
    </>
  );
}

function PositionRowMobile({ pos, onBuy, onSell, onTransfer }: Readonly<PositionRowProps>) {
  const metrics = getPositionMetrics(pos);

  return (
    <div className="px-4 py-3 border-b border-line-subtle last:border-0">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <PositionTicker pos={pos} />
        </div>
        <PnlBadge
          pnl={metrics.pnl}
          pnlPct={metrics.pnlPct}
          pnlColor={metrics.pnlColor}
          currency={pos.currency}
        />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <PositionMetricCells
          pos={pos}
          metrics={metrics}
          cellClassName="text-xs font-medium text-content-secondary tabular-nums"
        />
      </div>

      <div className="mt-2.5">
        <PositionActions pos={pos} onBuy={onBuy} onSell={onSell} onTransfer={onTransfer} />
      </div>
    </div>
  );
}

function PositionRow({ pos, onBuy, onSell, onTransfer }: Readonly<PositionRowProps>) {
  const metrics = getPositionMetrics(pos);

  return (
    <div className="flex items-center gap-4 py-3 px-4 hover:bg-surface-muted rounded-xl transition-colors">
      <div className="w-24 shrink-0">
        <PositionTicker pos={pos} lineClamp />
      </div>

      <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
        <PositionMetricCells pos={pos} metrics={metrics} />
      </div>

      <div className="w-28 shrink-0">
        <PnlBadge
          pnl={metrics.pnl}
          pnlPct={metrics.pnlPct}
          pnlColor={metrics.pnlColor}
          currency={pos.currency}
        />
      </div>

      <PositionActions pos={pos} onBuy={onBuy} onSell={onSell} onTransfer={onTransfer} />
    </div>
  );
}

interface PositionsListProps extends PositionRowProps {
  positions: StockPosition[];
  isLoading: boolean;
}

function PortfolioPositionsList({
  positions,
  isLoading,
  onBuy,
  onSell,
  onTransfer,
}: Readonly<Omit<PositionsListProps, 'pos'>>) {
  const { t } = useTranslation('portfolio');
  if (isLoading) {
    return <Spinner className="h-4 w-4 text-content-subtle my-4 mx-auto" />;
  }
  if (positions.length === 0) {
    return (
      <div className="text-center py-8 text-content-faint text-sm border-2 border-dashed border-line-subtle rounded-2xl">
        {t('section.no_positions')}
      </div>
    );
  }

  const totals = getTotalMetrics(positions);
  const totalValueEUR = fmtDec(totals.totalMarketValue);
  const totalPnlEUR = fmtDec(totals.totalPnl);

  return (
    <div className="bg-surface rounded-2xl border border-line-subtle shadow-sm overflow-hidden">
      {/* Mobile : cards empilées */}
      <div className="sm:hidden">
        {positions.map((pos) => (
          <PositionRowMobile
            key={pos.ticker}
            pos={pos}
            onBuy={onBuy}
            onSell={onSell}
            onTransfer={onTransfer}
          />
        ))}
        {positions.length > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-surface-muted border-t border-line-subtle">
            <span className="text-[11px] font-bold text-content-subtle uppercase tracking-wider">
              {t('section.total_label')}
            </span>
            <div className="text-right">
              <p className="text-sm font-bold text-content tabular-nums">{totalValueEUR}</p>
              <p className={`text-[11px] tabular-nums ${totals.totalPnlColor}`}>
                {totals.totalPnl >= 0 ? '+' : ''}
                {totalPnlEUR} ({totals.totalPnlPct >= 0 ? '+' : ''}
                {totals.totalPnlPct.toFixed(2)} %)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Desktop : tableau horizontal */}
      <div className="hidden sm:block overflow-x-auto">
        <div className="min-w-[560px]">
          {positions.map((pos) => (
            <PositionRow
              key={pos.ticker}
              pos={pos}
              onBuy={onBuy}
              onSell={onSell}
              onTransfer={onTransfer}
            />
          ))}
          {positions.length > 1 && (
            <div className="flex items-center gap-4 py-3 px-4 bg-surface-muted border-t border-line-subtle">
              <div className="w-24 shrink-0">
                <span className="text-[11px] font-bold text-content-subtle uppercase tracking-wider">
                  {t('section.total_label')}
                </span>
              </div>
              <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                <div />
                <div />
                <div />
                <div>
                  <p className="font-bold text-content tabular-nums">{totalValueEUR}</p>
                </div>
              </div>
              <div className="w-28 shrink-0">
                <PnlBadge
                  pnl={totals.totalPnl}
                  pnlPct={totals.totalPnlPct}
                  pnlColor={totals.totalPnlColor}
                  currency="EUR"
                />
              </div>
              <div className="w-[5.5rem]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  accountId: number;
  readOnly?: boolean;
}

export function PortfolioSection({ accountId, readOnly = false }: Readonly<Props>) {
  const { t } = useTranslation('portfolio');
  const { data: positions = [], isLoading } = useStockPositions(accountId);
  const refresh = useRefreshPrices(accountId);
  const [showBuy, setShowBuy] = useState(false);
  const [buyPosition, setBuyPosition] = useState<StockPosition | null>(null);
  const [sellPosition, setSellPosition] = useState<StockPosition | null>(null);
  const [transferPosition, setTransferPosition] = useState<StockPosition | null>(null);

  const handleRefresh = () => {
    refresh.mutate(undefined, {
      onSuccess: () => showToast(t('section.refresh_success')),
      onError: (err) => showToast(err.message),
    });
  };

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-content-subtle">
            {t('section.title')}
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleRefresh} disabled={refresh.isPending}>
              {refresh.isPending ? t('section.refreshing') : t('section.refresh_btn')}
            </Button>
            {!readOnly && (
              <Button size="sm" variant="primary" onClick={() => setShowBuy(true)}>
                {t('section.buy_btn')}
              </Button>
            )}
          </div>
        </div>

        <PortfolioPositionsList
          positions={positions}
          isLoading={isLoading}
          onBuy={readOnly ? undefined : setBuyPosition}
          onSell={readOnly ? undefined : setSellPosition}
          onTransfer={readOnly ? undefined : setTransferPosition}
        />
      </div>

      {showBuy && (
        <StockOperationModal mode="buy" accountId={accountId} onClose={() => setShowBuy(false)} />
      )}
      {buyPosition && (
        <StockOperationModal
          mode="buy"
          accountId={accountId}
          position={buyPosition}
          onClose={() => setBuyPosition(null)}
        />
      )}
      {sellPosition && (
        <StockOperationModal
          mode="sell"
          accountId={accountId}
          position={sellPosition}
          onClose={() => setSellPosition(null)}
        />
      )}
      {transferPosition && (
        <TransferStockModal
          accountId={accountId}
          position={transferPosition}
          onClose={() => setTransferPosition(null)}
        />
      )}
    </>
  );
}
