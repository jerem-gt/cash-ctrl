import { type ReactNode, useState } from 'react';

import { StockOperationModal } from '@/components/StockOperationModal';
import { Button, showToast } from '@/components/ui';
import { useRefreshPrices, useStockPositions } from '@/hooks/useStocks';
import { fmtStockPrice } from '@/lib/format';
import type { StockPosition } from '@/types';

interface PositionRowProps {
  pos: StockPosition;
  onSell: (pos: StockPosition) => void;
}

const getPnlColor = (pnl: number | null) => {
  if (pnl == null) return 'text-stone-400';
  if (pnl > 0) return 'text-green-700';
  if (pnl < 0) return 'text-red-700';
  return 'text-stone-500'; // Cas pnl === 0
};

function PositionRow({ pos, onSell }: Readonly<PositionRowProps>) {
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
          <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">Quantité</p>
          <p className="font-medium text-stone-700 tabular-nums">{pos.quantity}</p>
        </div>
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">PRU</p>
          <p className="font-medium text-stone-700 tabular-nums">
            {fmtStockPrice(pos.avg_price, pos.currency)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">Cours</p>
          <p className="font-medium text-stone-700 tabular-nums">
            {pos.current_price == null ? '—' : fmtStockPrice(pos.current_price, pos.currency)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">Valorisation</p>
          <p className="font-medium text-stone-700 tabular-nums">
            {marketValue == null
              ? '—'
              : marketValue.toLocaleString('fr-FR', { style: 'currency', currency: pos.currency })}
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
              {pnl.toLocaleString('fr-FR', { style: 'currency', currency: pos.currency })}
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

      <button
        onClick={() => onSell(pos)}
        className="text-[11px] font-bold text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded-lg border border-red-200 transition-all shrink-0"
        title="Vendre"
      >
        Vendre
      </button>
    </div>
  );
}

interface Props {
  accountId: number;
}

export function PortfolioSection({ accountId }: Readonly<Props>) {
  const { data: positions = [], isLoading } = useStockPositions(accountId);
  const refresh = useRefreshPrices(accountId);
  const [showBuy, setShowBuy] = useState(false);
  const [sellPosition, setSellPosition] = useState<StockPosition | null>(null);

  const totalMarketValue = positions.reduce(
    (sum, p) => sum + (p.current_price == null ? 0 : p.current_price * p.quantity),
    0,
  );
  const totalCostBasis = positions.reduce((sum, p) => sum + p.avg_price * p.quantity, 0);
  const totalPnl = totalMarketValue - totalCostBasis;
  const totalPnlPct = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0;

  const handleRefresh = () => {
    refresh.mutate(undefined, {
      onSuccess: () => showToast('Cours mis à jour ✓'),
      onError: (err) => showToast(err.message),
    });
  };

  const totalPnlColor = getPnlColor(totalPnl);

  let portfolioContent: ReactNode;
  if (isLoading) {
    portfolioContent = <div className="text-sm text-stone-400 py-4">Chargement…</div>;
  } else if (positions.length === 0) {
    portfolioContent = (
      <div className="text-center py-8 text-stone-300 text-sm border-2 border-dashed border-stone-100 rounded-2xl">
        Aucune position ouverte
      </div>
    );
  } else {
    portfolioContent = (
      <div className="bg-white rounded-2xl border border-black/[0.07] shadow-sm overflow-hidden">
        {positions.map((pos) => (
          <PositionRow key={pos.ticker} pos={pos} onSell={setSellPosition} />
        ))}

        {positions.length > 1 && (
          <div className="flex items-center gap-4 py-3 px-4 bg-stone-50 border-t border-stone-100">
            <div className="w-24 shrink-0">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Total
              </span>
            </div>
            <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
              <div />
              <div />
              <div />
              <div>
                <p className="font-bold text-stone-800 tabular-nums">
                  {totalMarketValue.toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'EUR',
                  })}
                </p>
              </div>
            </div>
            <div className="w-28 text-right shrink-0">
              <p className={`text-sm font-bold tabular-nums ${totalPnlColor}`}>
                {totalPnl >= 0 ? '+' : ''}
                {totalPnl.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </p>
              <p className={`text-[11px] tabular-nums ${totalPnlColor}`}>
                {totalPnlPct >= 0 ? '+' : ''}
                {totalPnlPct.toFixed(2)} %
              </p>
            </div>
            <div className="w-10" />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
            Portefeuille
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleRefresh} disabled={refresh.isPending}>
              {refresh.isPending ? '…' : '↻ Actualiser les cours'}
            </Button>
            <Button size="sm" variant="primary" onClick={() => setShowBuy(true)}>
              + Acheter
            </Button>
          </div>
        </div>

        {portfolioContent}
      </div>

      {showBuy && (
        <StockOperationModal mode="buy" accountId={accountId} onClose={() => setShowBuy(false)} />
      )}
      {sellPosition && (
        <StockOperationModal
          mode="sell"
          accountId={accountId}
          position={sellPosition}
          onClose={() => setSellPosition(null)}
        />
      )}
    </>
  );
}
