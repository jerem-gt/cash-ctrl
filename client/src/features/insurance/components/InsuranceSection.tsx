import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ConfirmModal, IconButton, showToast, Spinner } from '@/components/ui';
import {
  useDeleteInsuranceOperation,
  useDeleteInsuranceSupport,
  useInsuranceOperations,
  useInsurancePositions,
} from '@/features/insurance/hooks/useInsurance';
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
  const { t } = useTranslation('insurance');
  const [activeModal, setActiveModal] = useState<
    'versement' | 'rachat' | 'arbitrage' | 'interets' | 'revalorisation' | 'delete' | null
  >(null);
  const deleteSupport = useDeleteInsuranceSupport(accountId);

  const badgeClass =
    support.type === 'euro' ? 'bg-warning-surface text-warning' : 'bg-info-surface text-info';
  const badgeLabel = support.type === 'euro' ? t('section.badge_euro') : t('section.badge_uc');
  const actionButtons = !readOnly && (
    <div className="flex gap-1 flex-wrap">
      <button
        onClick={() => setActiveModal('versement')}
        className="text-[11px] font-bold text-success hover:text-success hover:bg-success-surface px-2 py-1 rounded-lg border border-success/30 transition-all"
      >
        {t('section.action_versement')}
      </button>
      <button
        onClick={() => setActiveModal('rachat')}
        className="text-[11px] font-bold text-danger hover:text-danger hover:bg-danger-surface px-2 py-1 rounded-lg border border-danger/30 transition-all"
      >
        {t('section.action_rachat')}
      </button>
      <button
        onClick={() => setActiveModal('arbitrage')}
        className="text-[11px] font-bold text-info hover:text-info hover:bg-info-surface px-2 py-1 rounded-lg border border-info/30 transition-all"
      >
        {t('section.action_arbitrage')}
      </button>
      {support.type === 'euro' && (
        <button
          onClick={() => setActiveModal('interets')}
          className="text-[11px] font-bold text-warning hover:text-warning hover:bg-warning-surface px-2 py-1 rounded-lg border border-warning/30 transition-all"
        >
          {t('section.action_interets')}
        </button>
      )}
      {support.type === 'uc' && (
        <button
          onClick={() => setActiveModal('revalorisation')}
          className="text-[11px] font-bold text-violet-600 hover:text-violet-800 hover:bg-violet-50 px-2 py-1 rounded-lg border border-violet-200 transition-all"
        >
          {t('section.action_revalorisation')}
        </button>
      )}
      <button
        onClick={() => setActiveModal('delete')}
        className="text-[11px] text-content-subtle hover:text-danger px-2 py-1 rounded-lg transition-all"
        title={t('section.delete_support_btn_title')}
      >
        ×
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile card */}
      <div className="sm:hidden px-4 py-3 border-b border-line-subtle">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${badgeClass}`}
            >
              {badgeLabel}
            </span>
            <p className="text-sm font-medium text-content mt-0.5 leading-tight truncate">
              {support.name}
            </p>
            {support.ticker && (
              <p className="text-[10px] text-content-subtle font-mono">{support.ticker}</p>
            )}
          </div>
          <p className="text-sm font-bold text-content tabular-nums shrink-0">
            {fmtDec(support.value)}
          </p>
        </div>
        {actionButtons}
      </div>

      {/* Desktop row */}
      <div className="hidden sm:flex items-center gap-4 py-3 px-4 hover:bg-surface-muted rounded-xl transition-colors">
        <div className="w-40 shrink-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${badgeClass}`}
            >
              {badgeLabel}
            </span>
          </div>
          <p className="text-sm font-medium text-content mt-0.5 leading-tight">{support.name}</p>
          {support.ticker && (
            <p className="text-[10px] text-content-subtle font-mono">{support.ticker}</p>
          )}
        </div>

        <div className="flex-1">
          <p className="text-[10px] text-content-subtle uppercase tracking-wider mb-0.5">
            {t('section.support_value_label')}
          </p>
          <p className="font-medium text-content-secondary tabular-nums">{fmtDec(support.value)}</p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-content tabular-nums">{fmtDec(support.value)}</p>
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
          title={t('section.delete_support_title')}
          body={t('section.delete_support_body', { name: support.name })}
          onConfirm={() => {
            deleteSupport.mutate(support.id, {
              onSuccess: () => showToast(t('section.support_deleted')),
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

const OPERATIONS_PAGE_SIZE = 10;

const OP_BADGE_CLASSES: Record<InsuranceOperation['type'], string> = {
  versement: 'bg-success-surface text-success',
  rachat: 'bg-danger-surface text-danger',
  arbitrage_in: 'bg-info-surface text-info',
  arbitrage_out: 'bg-info-surface text-info',
  interets: 'bg-warning-surface text-warning',
  revalorisation: 'bg-violet-100 text-violet-700',
};

const OP_SIGN: Record<InsuranceOperation['type'], (op: InsuranceOperation) => number> = {
  versement: (op) => op.amount,
  rachat: (op) => -op.amount,
  arbitrage_in: (op) => op.amount,
  arbitrage_out: (op) => -op.amount,
  interets: (op) => op.amount,
  revalorisation: (op) => op.amount,
};

function OperationRow({
  op,
  onEdit,
  onDelete,
}: Readonly<{ op: InsuranceOperation; onEdit?: () => void; onDelete?: () => void }>) {
  const { t } = useTranslation('insurance');
  const opLabels: Record<InsuranceOperation['type'], string> = {
    versement: t('section.op_versement'),
    rachat: t('section.op_rachat'),
    arbitrage_in: t('section.op_arbitrage_in'),
    arbitrage_out: t('section.op_arbitrage_out'),
    interets: t('section.op_interets'),
    revalorisation: t('section.op_revalorisation'),
  };
  const signed = OP_SIGN[op.type](op);

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted transition-colors">
      <span className="text-[10px] text-content-subtle w-20 shrink-0 tabular-nums">
        {fmtDate(op.date)}
      </span>

      <span
        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${OP_BADGE_CLASSES[op.type]}`}
      >
        {opLabels[op.type]}
      </span>
      <span className="text-sm text-content-secondary flex-1 truncate">{op.support_name}</span>
      {op.from_scheduled && (
        <span className="text-[12px] text-info shrink-0" title={t('section.scheduled_title')}>
          ↻
        </span>
      )}
      {op.fees > 0 && (
        <span className="hidden sm:inline text-[10px] text-content-subtle shrink-0">
          {t('section.op_fees', { amount: fmtDec(op.fees) })}
        </span>
      )}
      {op.social_fees > 0 && (
        <span className="hidden sm:inline text-[10px] text-content-subtle shrink-0">
          {t('section.op_social_fees', { amount: fmtDec(op.social_fees) })}
        </span>
      )}
      <span
        className={`text-sm font-medium tabular-nums shrink-0 ${
          signed >= 0 ? 'text-success' : 'text-danger'
        }`}
      >
        {signed >= 0 ? '+' : ''}
        {fmtDec(signed)}
      </span>
      {onEdit && (
        <IconButton label={t('section.edit_label')} size="sm" onClick={onEdit}>
          <span aria-hidden="true" className="text-xs">
            ✎
          </span>
        </IconButton>
      )}
      {onDelete && (
        <IconButton label={t('section.delete_label')} size="sm" variant="danger" onClick={onDelete}>
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
  const { t } = useTranslation('insurance');
  const { data: positions = [], isLoading } = useInsurancePositions(accountId);
  const { data: operations = [] } = useInsuranceOperations(accountId);
  const deleteOp = useDeleteInsuranceOperation(accountId);
  const [showAdd, setShowAdd] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [editingOp, setEditingOp] = useState<InsuranceOperation | null>(null);
  const [deletingOp, setDeletingOp] = useState<InsuranceOperation | null>(null);
  const [visibleCount, setVisibleCount] = useState(OPERATIONS_PAGE_SIZE);

  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
  const [showZero, setShowZero] = useState(false);

  function renderPositions() {
    if (isLoading) {
      return <Spinner className="h-4 w-4 text-content-subtle my-4 mx-auto" />;
    }
    if (positions.length === 0) {
      return (
        <div className="text-center py-8 text-content-faint text-sm border-2 border-dashed border-line-subtle rounded-2xl">
          {t('section.no_support')}
        </div>
      );
    }
    const activePositions = positions.filter((p) => p.value !== 0);
    const zeroPositions = positions.filter((p) => p.value === 0);
    const visiblePositions = activePositions.length === 0 ? positions : activePositions;
    const hasZeroSection = activePositions.length > 0 && zeroPositions.length > 0;

    return (
      <div className="bg-surface rounded-2xl border border-line-subtle shadow-sm overflow-hidden">
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
              className="w-full flex items-center justify-between px-4 py-2 bg-surface-muted border-t border-line-subtle text-[11px] font-medium text-content-subtle hover:text-content-secondary transition-colors"
            >
              <span>{t('section.zero_supports', { count: zeroPositions.length })}</span>
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
          <div className="flex items-center justify-between py-3 px-4 bg-surface-muted border-t border-line-subtle">
            <span className="text-[11px] font-bold text-content-subtle uppercase tracking-wider">
              {t('section.total_envelope')}
            </span>
            <span className="text-sm font-bold text-content tabular-nums">
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
          <p className="text-[10px] font-medium uppercase tracking-widest text-content-subtle">
            {t('section.envelope_title')}
          </p>
          <div className="flex items-center gap-2">
            {isPer && (
              <Button size="sm" onClick={() => setShowSimulator(true)}>
                {t('section.simulator_btn')}
              </Button>
            )}
            {!readOnly && (
              <Button size="sm" variant="primary" onClick={() => setShowAdd(true)}>
                {t('section.add_support_btn')}
              </Button>
            )}
          </div>
        </div>

        {renderPositions()}
      </div>

      <div>
        <p className="text-[10px] font-medium uppercase tracking-widest text-content-subtle mb-4">
          {t('section.history_title')}
        </p>
        {operations.length === 0 ? (
          <div className="text-sm text-content-faint text-center py-6">
            {t('section.no_operations')}
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-line-subtle shadow-sm overflow-hidden divide-y divide-line-subtle">
            {operations.slice(0, visibleCount).map((op) => (
              <OperationRow
                key={op.id}
                op={op}
                onEdit={readOnly ? undefined : () => setEditingOp(op)}
                onDelete={readOnly ? undefined : () => setDeletingOp(op)}
              />
            ))}
            {operations.length > visibleCount && (
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + OPERATIONS_PAGE_SIZE)}
                className="w-full flex items-center justify-center px-4 py-2.5 bg-surface-muted text-[11px] font-medium text-content-subtle hover:text-content-secondary transition-colors"
              >
                {t('section.show_more', { count: operations.length - visibleCount })}
              </button>
            )}
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
          title={t('section.delete_op_title')}
          body={t('section.delete_op_body')}
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
