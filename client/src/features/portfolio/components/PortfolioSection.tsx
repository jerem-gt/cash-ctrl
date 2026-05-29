import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, showToast, Spinner } from '@/components/ui';
import { StockOperationModal } from '@/features/portfolio/components/StockOperationModal';
import { TransferStockModal } from '@/features/portfolio/components/TransferStockModal';
import { useRefreshPrices, useStockPositions } from '@/features/portfolio/hooks/useStocks';
import { currentLocale, fmtStockPrice } from '@/lib/format';
import type { StockPosition } from '@/types';

interface PositionRowProps {
  pos: StockPosition;
  onBuy?: (pos: StockPosition) => void;
  onSell?: (pos: StockPosition) => void;
  onTransfer?: (pos: StockPosition) => void;
}

const getPnlColor = (pnl: number | null) => {
  if (pnl == null) return 'text-stone-400';
  if (pnl > 0) return 'text-green-700';
  if (pnl < 0) return 'text-red-700';
  return 'text-stone-500';
};

function PositionRowMobile({ pos, onBuy, onSell, onTransfer }: Readonly<PositionRowProps>) {
  const { t } = useTranslation('portfolio');
  const marketValue = pos.current_price == null ? null : pos.current_price * pos.quantity;
  const costBasis = pos.avg_price * pos.quantity;
  const pnl = marketValue == null ? null : marketValue - costBasis;
  const pnlPct = pnl != null && costBasis > 0 ? (pnl / costBasis) * 100 : null;
  const pnlColor = getPnlColor(pnl);
  const hasActions = onBuy != null || onSell != null || onTransfer != null;

  return (
    <div className="px-4 py-3 border-b border-stone-100 last:border-0">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <span className="text-sm font-bold text-stone-800 font-mono">{pos.ticker}</span>
          {pos.name && (
            <p className="text-[10px] text-stone-400 truncate mt-0.5" title={pos.name}>
              {pos.name}
            </p>
          )}
        </div>
        {pnl == null ? (
          <p className="text-sm text-stone-300">—</p>
        ) : (
          <div className="text-right">
            <p className={`text-sm font-bold tabular-nums ${pnlColor}`}>
              {pnl >= 0 ? '+' : ''}
              {pnl.toLocaleString(currentLocale(), { style: 'currency', currency: pos.currency })}
            </p>
            {pnlPct != null && (
              <p className={`text-[11px] tabular-nums ${pnlColor}`}>
                {pnlPct >= 0 ? '+' : ''}
                {pnlPct.toFixed(2)} %
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">
            {t('section.col_quantity')}
          </p>
          <p className="text-xs font-medium text-stone-700 tabular-nums">{pos.quantity}</p>
        </div>
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">
            {t('section.col_pru')}
          </p>
          <p className="text-xs font-medium text-stone-700 tabular-nums">
            {fmtStockPrice(pos.avg_price, pos.currency)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">
            {t('section.col_price')}
          </p>
          <p className="text-xs font-medium text-stone-700 tabular-nums">
            {pos.current_price == null ? '—' : fmtStockPrice(pos.current_price, pos.currency)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">
            {t('section.col_valuation')}
          </p>
          <p className="text-xs font-medium text-stone-700 tabular-nums">
            {marketValue == null
              ? '—'
              : marketValue.toLocaleString(currentLocale(), {
                  style: 'currency',
                  currency: pos.currency,
                })}
          </p>
        </div>
      </div>

      {hasActions && (
        <div className="flex gap-1 mt-2.5">
          {onBuy && (
            <button
              onClick={() => onBuy(pos)}
              className="text-[11px] font-bold text-green-700 hover:text-green-900 hover:bg-green-50 px-2 py-1 rounded-lg border border-green-200 transition-all"
            >
              {t('section.action_buy')}
            </button>
          )}
          {onSell && (
            <button
              onClick={() => onSell(pos)}
              className="text-[11px] font-bold text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded-lg border border-red-200 transition-all"
            >
              {t('section.action_sell')}
            </button>
          )}
          {onTransfer && (
            <button
              onClick={() => onTransfer(pos)}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-lg border border-blue-200 transition-all"
            >
              {t('section.action_transfer')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PositionRow({ pos, onBuy, onSell, onTransfer }: Readonly<PositionRowProps>) {
  const { t } = useTranslation('portfolio');
  const marketValue = pos.current_price == null ? null : pos.current_price * pos.quantity;
  const costBasis = pos.avg_price * pos.quantity;
  const pnl = marketValue == null ? null : marketValue - costBasis;
  const pnlPct = pnl != null && costBasis > 0 ? (pnl / costBasis) * 100 : null;
  const pnlColor = getPnlColor(pnl);

  return (
    <div className="flex items-center gap-4 py-3 px-4 hover:bg-stone-50 rounded-xl transition-colors">
      <div className="w-24 shrink-0">
        <span className="text-sm font-bold text-stone-800 font-mono">{pos.ticker}</span>
        {pos.name && (
          <p className="text-[10px] text-stone-400 line-clamp-2 mt-0.5" title={pos.name}>
            {pos.name}
          </p>
        )}
      </div>

      <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">
            {t('section.col_quantity')}
          </p>
          <p className="font-medium text-stone-700 tabular-nums">{pos.quantity}</p>
        </div>
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">
            {t('section.col_pru')}
          </p>
          <p className="font-medium text-stone-700 tabular-nums">
            {fmtStockPrice(pos.avg_price, pos.currency)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">
            {t('section.col_price')}
          </p>
          <p className="font-medium text-stone-700 tabular-nums">
            {pos.current_price == null ? '—' : fmtStockPrice(pos.current_price, pos.currency)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">
            {t('section.col_valuation')}
          </p>
          <p className="font-medium text-stone-700 tabular-nums">
            {marketValue == null
              ? '—'
              : marketValue.toLocaleString(currentLocale(), {
                  style: 'currency',
                  currency: pos.currency,
                })}
          </p>
        </div>
      </div>

      <div className="w-28 text-right shrink-0">
        {pnl == null ? (
          <p className="text-sm text-stone-300">—</p>
        ) : (
          <div>
            <p className={`text-sm font-bold tabular-nums ${pnlColor}`}>
              {pnl >= 0 ? '+' : ''}
              {pnl.toLocaleString(currentLocale(), { style: 'currency', currency: pos.currency })}
            </p>
            {pnlPct != null && (
              <p className={`text-[11px] tabular-nums ${pnlColor}`}>
                {pnlPct >= 0 ? '+' : ''}
                {pnlPct.toFixed(2)} %
              </p>
            )}
          </div>
        )}
      </div>

      {(onBuy ?? onSell ?? onTransfer) && (
        <div className="flex gap-1 shrink-0">
          {onBuy && (
            <button
              onClick={() => onBuy(pos)}
              className="text-[11px] font-bold text-green-700 hover:text-green-900 hover:bg-green-50 px-2 py-1 rounded-lg border border-green-200 transition-all"
              title={t('section.action_buy')}
            >
              {t('section.action_buy')}
            </button>
          )}
          {onSell && (
            <button
              onClick={() => onSell(pos)}
              className="text-[11px] font-bold text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded-lg border border-red-200 transition-all"
              title={t('section.action_sell')}
            >
              {t('section.action_sell')}
            </button>
          )}
          {onTransfer && (
            <button
              onClick={() => onTransfer(pos)}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-lg border border-blue-200 transition-all"
              title={t('section.transfer_title')}
            >
              {t('section.action_transfer')}
            </button>
          )}
        </div>
      )}
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
    return <Spinner className="h-4 w-4 text-stone-400 my-4 mx-auto" />;
  }
  if (positions.length === 0) {
    return (
      <div className="text-center py-8 text-stone-300 text-sm border-2 border-dashed border-stone-100 rounded-2xl">
        {t('section.no_positions')}
      </div>
    );
  }

  const totalMarketValue = positions.reduce(
    (sum, p) => sum + (p.current_price == null ? 0 : p.current_price * p.quantity),
    0,
  );
  const totalCostBasis = positions.reduce((sum, p) => sum + p.avg_price * p.quantity, 0);
  const totalPnl = totalMarketValue - totalCostBasis;
  const totalPnlPct = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0;
  const totalPnlColor = getPnlColor(totalPnl);

  return (
    <div className="bg-white rounded-2xl border border-black/[0.07] shadow-sm overflow-hidden">
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
          <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-t border-stone-100">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
              {t('section.total_label')}
            </span>
            <div className="text-right">
              <p className="text-sm font-bold text-stone-800 tabular-nums">
                {totalMarketValue.toLocaleString(currentLocale(), {
                  style: 'currency',
                  currency: 'EUR',
                })}
              </p>
              <p className={`text-[11px] tabular-nums ${totalPnlColor}`}>
                {totalPnl >= 0 ? '+' : ''}
                {totalPnl.toLocaleString(currentLocale(), { style: 'currency', currency: 'EUR' })} (
                {totalPnlPct >= 0 ? '+' : ''}
                {totalPnlPct.toFixed(2)} %)
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
            <div className="flex items-center gap-4 py-3 px-4 bg-stone-50 border-t border-stone-100">
              <div className="w-24 shrink-0">
                <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  {t('section.total_label')}
                </span>
              </div>
              <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                <div />
                <div />
                <div />
                <div>
                  <p className="font-bold text-stone-800 tabular-nums">
                    {totalMarketValue.toLocaleString(currentLocale(), {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </p>
                </div>
              </div>
              <div className="w-28 text-right shrink-0">
                <p className={`text-sm font-bold tabular-nums ${totalPnlColor}`}>
                  {totalPnl >= 0 ? '+' : ''}
                  {totalPnl.toLocaleString(currentLocale(), { style: 'currency', currency: 'EUR' })}
                </p>
                <p className={`text-[11px] tabular-nums ${totalPnlColor}`}>
                  {totalPnlPct >= 0 ? '+' : ''}
                  {totalPnlPct.toFixed(2)} %
                </p>
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
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
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
