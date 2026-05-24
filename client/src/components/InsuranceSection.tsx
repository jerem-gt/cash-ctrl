import { useState } from 'react';

import {
  useDeleteInsuranceOperation,
  useDeleteInsuranceSupport,
  useInsuranceOperations,
  useInsurancePositions,
} from '@/hooks/useInsurance';
import { fmtDate, fmtDec } from '@/lib/format';
import type { InsuranceOperation, InsuranceSupportView } from '@/types';

import { AddInsuranceSupportModal } from './AddInsuranceSupportModal';
import { InsuranceArbitrageModal } from './InsuranceArbitrageModal';
import { InsuranceEditOperationModal } from './InsuranceEditOperationModal';
import { InsuranceInteretsModal } from './InsuranceInteretsModal';
import { InsuranceRachatModal } from './InsuranceRachatModal';
import { InsuranceRevalorisationModal } from './InsuranceRevalorisationModal';
import { InsuranceVersementModal } from './InsuranceVersementModal';
import { PerFiscalSimulatorModal } from './PerFiscalSimulatorModal';
import { Button, ConfirmModal, IconButton, showToast, Spinner } from './ui';

interface SupportRowProps {
  support: InsuranceSupportView;
  allSupports: InsuranceSupportView[];
  accountId: number;
  readOnly?: boolean;
}

function SupportRow({
  support,
  allSupports,
  accountId,
  readOnly = false,
}: Readonly<SupportRowProps>) {
  const [activeModal, setActiveModal] = useState<
    'versement' | 'rachat' | 'arbitrage' | 'interets' | 'revalorisation' | 'delete' | null
  >(null);
  const deleteSupport = useDeleteInsuranceSupport(accountId);

  const badgeClass =
    support.type === 'euro' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700';
  const badgeLabel = support.type === 'euro' ? 'Euro' : 'UC';
  const actionButtons = !readOnly && (
    <div className="flex gap-1 flex-wrap">
      <button
        onClick={() => setActiveModal('versement')}
        className="text-[11px] font-bold text-green-700 hover:text-green-900 hover:bg-green-50 px-2 py-1 rounded-lg border border-green-200 transition-all"
      >
        Verser
      </button>
      <button
        onClick={() => setActiveModal('rachat')}
        className="text-[11px] font-bold text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded-lg border border-red-200 transition-all"
      >
        Racheter
      </button>
      <button
        onClick={() => setActiveModal('arbitrage')}
        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-lg border border-blue-200 transition-all"
      >
        Arbitrer
      </button>
      {support.type === 'euro' && (
        <button
          onClick={() => setActiveModal('interets')}
          className="text-[11px] font-bold text-amber-600 hover:text-amber-800 hover:bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 transition-all"
        >
          Intérêts
        </button>
      )}
      {support.type === 'uc' && (
        <button
          onClick={() => setActiveModal('revalorisation')}
          className="text-[11px] font-bold text-violet-600 hover:text-violet-800 hover:bg-violet-50 px-2 py-1 rounded-lg border border-violet-200 transition-all"
        >
          Revaloriser
        </button>
      )}
      <button
        onClick={() => setActiveModal('delete')}
        className="text-[11px] text-stone-400 hover:text-red-500 px-2 py-1 rounded-lg transition-all"
        title="Supprimer le support"
      >
        ×
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile card */}
      <div className="sm:hidden px-4 py-3 border-b border-stone-100">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${badgeClass}`}
            >
              {badgeLabel}
            </span>
            <p className="text-sm font-medium text-stone-800 mt-0.5 leading-tight truncate">
              {support.name}
            </p>
            {support.ticker && (
              <p className="text-[10px] text-stone-400 font-mono">{support.ticker}</p>
            )}
          </div>
          <p className="text-sm font-bold text-stone-800 tabular-nums shrink-0">
            {fmtDec(support.value)}
          </p>
        </div>
        {actionButtons}
      </div>

      {/* Desktop row */}
      <div className="hidden sm:flex items-center gap-4 py-3 px-4 hover:bg-stone-50 rounded-xl transition-colors">
        <div className="w-40 shrink-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${badgeClass}`}
            >
              {badgeLabel}
            </span>
          </div>
          <p className="text-sm font-medium text-stone-800 mt-0.5 leading-tight">{support.name}</p>
          {support.ticker && (
            <p className="text-[10px] text-stone-400 font-mono">{support.ticker}</p>
          )}
        </div>

        <div className="flex-1">
          <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">Valeur</p>
          <p className="font-medium text-stone-700 tabular-nums">{fmtDec(support.value)}</p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-stone-800 tabular-nums">{fmtDec(support.value)}</p>
        </div>

        {actionButtons && <div className="shrink-0 justify-end">{actionButtons}</div>}
      </div>

      {activeModal === 'versement' && (
        <InsuranceVersementModal
          accountId={accountId}
          support={support}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'rachat' && (
        <InsuranceRachatModal
          accountId={accountId}
          support={support}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'arbitrage' && (
        <InsuranceArbitrageModal
          accountId={accountId}
          fromSupport={support}
          allSupports={allSupports}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'interets' && support.type === 'euro' && (
        <InsuranceInteretsModal
          accountId={accountId}
          support={support}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'revalorisation' && support.type === 'uc' && (
        <InsuranceRevalorisationModal
          accountId={accountId}
          support={support}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'delete' && (
        <ConfirmModal
          title="Supprimer le support"
          body={`Supprimer « ${support.name} » ? Cette action est irréversible.`}
          onConfirm={() => {
            deleteSupport.mutate(support.id, {
              onSuccess: () => showToast('Support supprimé ✓'),
              onError: (err) => showToast(err.message),
            });
          }}
          onCancel={() => setActiveModal(null)}
          isPending={deleteSupport.isPending}
        />
      )}
    </>
  );
}

const OP_CONFIG: Record<
  InsuranceOperation['type'],
  { label: string; badgeClass: string; sign: (op: InsuranceOperation) => number }
> = {
  versement: {
    label: 'Versement',
    badgeClass: 'bg-green-100 text-green-700',
    sign: (op) => op.amount,
  },
  rachat: { label: 'Rachat', badgeClass: 'bg-red-100 text-red-700', sign: (op) => -op.amount },
  arbitrage_in: {
    label: 'Arbitrage ←',
    badgeClass: 'bg-blue-100 text-blue-700',
    sign: (op) => op.amount,
  },
  arbitrage_out: {
    label: 'Arbitrage →',
    badgeClass: 'bg-blue-100 text-blue-700',
    sign: (op) => -op.amount,
  },
  interets: {
    label: 'Intérêts',
    badgeClass: 'bg-amber-100 text-amber-700',
    sign: (op) => op.amount,
  },
  revalorisation: {
    label: 'Revalorisation',
    badgeClass: 'bg-violet-100 text-violet-700',
    sign: (op) => op.amount,
  },
};

function OperationRow({
  op,
  onEdit,
  onDelete,
}: Readonly<{ op: InsuranceOperation; onEdit?: () => void; onDelete?: () => void }>) {
  const cfg = OP_CONFIG[op.type];
  const signed = cfg.sign(op);

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors">
      <span className="text-[10px] text-stone-400 w-20 shrink-0 tabular-nums">
        {fmtDate(op.date)}
      </span>

      <span
        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${cfg.badgeClass}`}
      >
        {cfg.label}
      </span>
      <span className="text-sm text-stone-600 flex-1 truncate">{op.support_name}</span>
      {op.from_scheduled && (
        <span className="text-[12px] text-indigo-400 shrink-0" title="Transaction planifiée">
          ↻
        </span>
      )}
      {op.fees > 0 && (
        <span className="hidden sm:inline text-[10px] text-stone-400 shrink-0">
          frais {fmtDec(op.fees)}
        </span>
      )}
      {op.social_fees > 0 && (
        <span className="hidden sm:inline text-[10px] text-stone-400 shrink-0">
          prél. soc. {fmtDec(op.social_fees)}
        </span>
      )}
      <span
        className={`text-sm font-medium tabular-nums shrink-0 ${
          signed >= 0 ? 'text-green-600' : 'text-red-600'
        }`}
      >
        {signed >= 0 ? '+' : ''}
        {fmtDec(signed)}
      </span>
      {onEdit && (
        <IconButton label="Modifier" size="sm" onClick={onEdit}>
          <span aria-hidden="true" className="text-xs">
            ✎
          </span>
        </IconButton>
      )}
      {onDelete && (
        <IconButton label="Supprimer" size="sm" variant="danger" onClick={onDelete}>
          <span aria-hidden="true" className="text-base leading-none">
            ×
          </span>
        </IconButton>
      )}
    </div>
  );
}

interface Props {
  accountId: number;
  isPer?: boolean;
  readOnly?: boolean;
}

export function InsuranceSection({ accountId, isPer = false, readOnly = false }: Readonly<Props>) {
  const { data: positions = [], isLoading } = useInsurancePositions(accountId);
  const { data: operations = [] } = useInsuranceOperations(accountId);
  const deleteOp = useDeleteInsuranceOperation(accountId);
  const [showAdd, setShowAdd] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [editingOp, setEditingOp] = useState<InsuranceOperation | null>(null);
  const [deletingOp, setDeletingOp] = useState<InsuranceOperation | null>(null);

  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
  const [showZero, setShowZero] = useState(false);

  function renderPositions() {
    if (isLoading) {
      return <Spinner className="h-4 w-4 text-stone-400 my-4 mx-auto" />;
    }
    if (positions.length === 0) {
      return (
        <div className="text-center py-8 text-stone-300 text-sm border-2 border-dashed border-stone-100 rounded-2xl">
          Aucun support — ajoutez un fonds euro ou une UC
        </div>
      );
    }
    const activePositions = positions.filter((p) => p.value !== 0);
    const zeroPositions = positions.filter((p) => p.value === 0);
    const visiblePositions = activePositions.length === 0 ? positions : activePositions;
    const hasZeroSection = activePositions.length > 0 && zeroPositions.length > 0;

    return (
      <div className="bg-white rounded-2xl border border-black/[0.07] shadow-sm overflow-hidden">
        {visiblePositions.map((pos) => (
          <SupportRow
            key={pos.id}
            support={pos}
            allSupports={positions}
            accountId={accountId}
            readOnly={readOnly}
          />
        ))}

        {hasZeroSection && (
          <>
            <button
              type="button"
              onClick={() => setShowZero((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2 bg-stone-50 border-t border-stone-100 text-[11px] font-medium text-stone-400 hover:text-stone-600 transition-colors"
            >
              <span>Supports soldés ({zeroPositions.length})</span>
              <span>{showZero ? '▲' : '▼'}</span>
            </button>
            {showZero &&
              zeroPositions.map((pos) => (
                <SupportRow
                  key={pos.id}
                  support={pos}
                  allSupports={positions}
                  accountId={accountId}
                  readOnly={readOnly}
                />
              ))}
          </>
        )}

        {positions.length > 1 && (
          <div className="flex items-center justify-between py-3 px-4 bg-stone-50 border-t border-stone-100">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
              Total enveloppe
            </span>
            <span className="text-sm font-bold text-stone-800 tabular-nums">
              {fmtDec(totalValue)}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
            Enveloppe
          </p>
          <div className="flex items-center gap-2">
            {isPer && (
              <Button size="sm" onClick={() => setShowSimulator(true)}>
                Simulateur fiscal
              </Button>
            )}
            {!readOnly && (
              <Button size="sm" variant="primary" onClick={() => setShowAdd(true)}>
                + Support
              </Button>
            )}
          </div>
        </div>

        {renderPositions()}
      </div>

      <div>
        <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-4">
          Historique
        </p>
        {operations.length === 0 ? (
          <div className="text-sm text-stone-300 text-center py-6">Aucune opération</div>
        ) : (
          <div className="bg-white rounded-2xl border border-black/[0.07] shadow-sm overflow-hidden divide-y divide-stone-50">
            {operations.map((op) => (
              <OperationRow
                key={op.id}
                op={op}
                onEdit={readOnly ? undefined : () => setEditingOp(op)}
                onDelete={readOnly ? undefined : () => setDeletingOp(op)}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddInsuranceSupportModal accountId={accountId} onClose={() => setShowAdd(false)} />
      )}
      {showSimulator && <PerFiscalSimulatorModal onClose={() => setShowSimulator(false)} />}
      {editingOp && (
        <InsuranceEditOperationModal
          accountId={accountId}
          op={editingOp}
          onClose={() => setEditingOp(null)}
        />
      )}
      {deletingOp && (
        <ConfirmModal
          title="Supprimer l'opération"
          body="Cette action est irréversible. Confirmer la suppression ?"
          onConfirm={() => {
            deleteOp.mutate(deletingOp.id, {
              onSuccess: () => setDeletingOp(null),
              onError: (e) => showToast(e.message),
            });
          }}
          onCancel={() => setDeletingOp(null)}
          isPending={deleteOp.isPending}
        />
      )}
    </>
  );
}
