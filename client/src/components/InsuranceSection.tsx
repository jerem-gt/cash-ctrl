import { type ReactNode, useState } from 'react';

import {
  useDeleteInsuranceSupport,
  useInsurancePositions,
  useRefreshInsurancePrices,
} from '@/hooks/useInsurance';
import { fmtStockPrice } from '@/lib/format';
import type { InsuranceSupportView } from '@/types';

import { AddInsuranceSupportModal } from './AddInsuranceSupportModal';
import { InsuranceArbitrageModal } from './InsuranceArbitrageModal';
import { InsuranceInteretsModal } from './InsuranceInteretsModal';
import { InsuranceRachatModal } from './InsuranceRachatModal';
import { InsuranceVersementModal } from './InsuranceVersementModal';
import { Button, showToast } from './ui';

interface SupportRowProps {
  support: InsuranceSupportView;
  allSupports: InsuranceSupportView[];
  accountId: number;
}

function SupportRow({ support, allSupports, accountId }: Readonly<SupportRowProps>) {
  const [showVersement, setShowVersement] = useState(false);
  const [showRachat, setShowRachat] = useState(false);
  const [showArbitrage, setShowArbitrage] = useState(false);
  const [showInterets, setShowInterets] = useState(false);
  const deleteSupport = useDeleteInsuranceSupport(accountId);

  const handleDelete = () => {
    deleteSupport.mutate(support.id, {
      onSuccess: () => showToast('Support supprimé ✓'),
      onError: (err) => showToast(err.message),
    });
  };

  const fmtEur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

  return (
    <>
      <div className="flex items-center gap-4 py-3 px-4 hover:bg-stone-50 rounded-xl transition-colors">
        <div className="w-40 shrink-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                support.type === 'euro'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {support.type === 'euro' ? 'Euro' : 'UC'}
            </span>
          </div>
          <p className="text-sm font-medium text-stone-800 mt-0.5 leading-tight">{support.name}</p>
          {support.ticker && (
            <p className="text-[10px] text-stone-400 font-mono">{support.ticker}</p>
          )}
        </div>

        <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
          {support.type === 'euro' ? (
            <>
              <div>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">Solde</p>
                <p className="font-medium text-stone-700 tabular-nums">
                  {support.balance == null ? '—' : fmtEur(support.balance)}
                </p>
              </div>
              <div />
              <div />
              <div />
            </>
          ) : (
            <>
              <div>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">Parts</p>
                <p className="font-medium text-stone-700 tabular-nums">
                  {support.quantity == null ? '—' : support.quantity.toFixed(6)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">PRU</p>
                <p className="font-medium text-stone-700 tabular-nums">
                  {support.avg_price == null
                    ? '—'
                    : fmtStockPrice(support.avg_price, support.current_price_currency)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">VL</p>
                <p className="font-medium text-stone-700 tabular-nums">
                  {support.current_price == null
                    ? '—'
                    : fmtStockPrice(support.current_price, support.current_price_currency)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">
                  Valorisation
                </p>
                <p className="font-medium text-stone-700 tabular-nums">{fmtEur(support.value)}</p>
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-stone-800 tabular-nums">{fmtEur(support.value)}</p>
        </div>

        <div className="flex gap-1 shrink-0 flex-wrap justify-end">
          <button
            onClick={() => setShowVersement(true)}
            className="text-[11px] font-bold text-green-700 hover:text-green-900 hover:bg-green-50 px-2 py-1 rounded-lg border border-green-200 transition-all"
          >
            Verser
          </button>
          <button
            onClick={() => setShowRachat(true)}
            className="text-[11px] font-bold text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded-lg border border-red-200 transition-all"
          >
            Racheter
          </button>
          <button
            onClick={() => setShowArbitrage(true)}
            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-lg border border-blue-200 transition-all"
          >
            Arbitrer
          </button>
          {support.type === 'euro' && (
            <button
              onClick={() => setShowInterets(true)}
              className="text-[11px] font-bold text-amber-600 hover:text-amber-800 hover:bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 transition-all"
            >
              Intérêts
            </button>
          )}
          <button
            onClick={handleDelete}
            className="text-[11px] text-stone-400 hover:text-red-500 px-2 py-1 rounded-lg transition-all"
            title="Supprimer le support"
          >
            ×
          </button>
        </div>
      </div>

      {showVersement && (
        <InsuranceVersementModal
          accountId={accountId}
          support={support}
          onClose={() => setShowVersement(false)}
        />
      )}
      {showRachat && (
        <InsuranceRachatModal
          accountId={accountId}
          support={support}
          onClose={() => setShowRachat(false)}
        />
      )}
      {showArbitrage && (
        <InsuranceArbitrageModal
          accountId={accountId}
          fromSupport={support}
          allSupports={allSupports}
          onClose={() => setShowArbitrage(false)}
        />
      )}
      {showInterets && support.type === 'euro' && (
        <InsuranceInteretsModal
          accountId={accountId}
          support={support}
          onClose={() => setShowInterets(false)}
        />
      )}
    </>
  );
}

interface Props {
  accountId: number;
}

export function InsuranceSection({ accountId }: Readonly<Props>) {
  const { data: positions = [], isLoading } = useInsurancePositions(accountId);
  const refresh = useRefreshInsurancePrices(accountId);
  const [showAdd, setShowAdd] = useState(false);

  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
  const hasUc = positions.some((p) => p.type === 'uc');

  const handleRefresh = () => {
    refresh.mutate(undefined, {
      onSuccess: () => showToast('VL mises à jour ✓'),
      onError: (err) => showToast(err.message),
    });
  };

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
            Enveloppe
          </p>
          <div className="flex gap-2">
            {hasUc && (
              <Button size="sm" onClick={handleRefresh} disabled={refresh.isPending}>
                {refresh.isPending ? '…' : '↻ Actualiser les VL'}
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={() => setShowAdd(true)}>
              + Support
            </Button>
          </div>
        </div>

        {(() => {
          let content: ReactNode;
          if (isLoading) {
            content = <div className="text-sm text-stone-400 py-4">Chargement…</div>;
          } else if (positions.length === 0) {
            content = (
              <div className="text-center py-8 text-stone-300 text-sm border-2 border-dashed border-stone-100 rounded-2xl">
                Aucun support — ajoutez un fonds euro ou une UC
              </div>
            );
          } else {
            content = (
              <div className="bg-white rounded-2xl border border-black/[0.07] shadow-sm overflow-hidden">
                {positions.map((pos) => (
                  <SupportRow
                    key={pos.id}
                    support={pos}
                    allSupports={positions}
                    accountId={accountId}
                  />
                ))}

                {positions.length > 1 && (
                  <div className="flex items-center justify-between py-3 px-4 bg-stone-50 border-t border-stone-100">
                    <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                      Total enveloppe
                    </span>
                    <span className="text-sm font-bold text-stone-800 tabular-nums">
                      {totalValue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                )}
              </div>
            );
          }
          return content;
        })()}
      </div>

      {showAdd && (
        <AddInsuranceSupportModal accountId={accountId} onClose={() => setShowAdd(false)} />
      )}
    </>
  );
}
