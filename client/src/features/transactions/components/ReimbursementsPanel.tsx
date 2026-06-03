import { type KeyboardEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, DecimalInput, FormGroup, Select, showToast } from '@/components/ui';
import {
  useLinkReimbursement,
  useReimbursements,
  useSetReimbursementStatus,
  useUnlinkReimbursement,
  useUpdateReimbursementAmount,
} from '@/features/transactions/hooks/useReimbursements';
import { useTransactions } from '@/hooks/useTransactions';
import { fmtDate, fmtDec } from '@/lib/format';
import type { Reimbursement, Transaction } from '@/types';

interface Props {
  tx: Transaction;
}

function AmountCell({
  reimbursement,
  onSave,
}: Readonly<{ reimbursement: Reimbursement; onSave: (amount: number | null) => void }>) {
  const { t } = useTranslation('transactions');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const isPartial = reimbursement.amount !== reimbursement.transaction_amount;

  const handleStartEdit = () => {
    setValue(reimbursement.amount.toFixed(2));
    setEditing(true);
  };

  const handleConfirm = () => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    const isFullAmount = parsed >= reimbursement.transaction_amount;
    onSave(isFullAmount ? null : parsed);
    setEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <DecimalInput
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-20! py-0.5! px-1.5! text-xs text-right tabular-nums"
        />
        <button
          type="button"
          onClick={handleConfirm}
          className="text-[11px] text-brand-600 hover:text-brand-800 font-bold leading-none"
        >
          ✓
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-[11px] text-content-subtle hover:text-content-secondary leading-none"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleStartEdit}
      className="text-right shrink-0 group"
      title={t('reimbursements_panel.edit_amount_title')}
    >
      <span className="text-xs font-medium text-success tabular-nums group-hover:underline decoration-dotted">
        +{fmtDec(reimbursement.amount)}
      </span>
      {isPartial && (
        <span className="block text-[10px] text-content-subtle tabular-nums leading-none mt-0.5">
          / {fmtDec(reimbursement.transaction_amount)}
        </span>
      )}
    </button>
  );
}

export function ReimbursementsPanel({ tx }: Readonly<Props>) {
  const { t } = useTranslation('transactions');
  const { t: tc } = useTranslation('common');
  const [localStatus, setLocalStatus] = useState<'en_attente' | 'rembourse' | null>(
    tx.reimbursement_status,
  );
  const [showAdd, setShowAdd] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState('');
  const [attributedAmount, setAttributedAmount] = useState('');

  const { data: reimbursements = [] } = useReimbursements(tx.id);
  const { data: incomeResult } = useTransactions({
    type: 'income',
    limit: 500,
    exclude_linked_reimbursements: true,
  });
  const incomeTransactions = incomeResult?.data ?? [];

  const setStatus = useSetReimbursementStatus();
  const link = useLinkReimbursement(tx.id);
  const unlink = useUnlinkReimbursement(tx.id);
  const updateAmount = useUpdateReimbursementAmount(tx.id);

  const totalReimbursed = reimbursements.reduce((s, r) => s + r.amount, 0);
  const remaining = tx.amount - totalReimbursed;

  const selectedTx = incomeTransactions.find((inc) => inc.id === Number.parseInt(selectedTxId));

  const handleToggle = () => {
    const newStatus: 'en_attente' | null = localStatus === null ? 'en_attente' : null;
    setLocalStatus(newStatus);
    setStatus.mutate(
      { id: tx.id, status: newStatus },
      { onError: (err) => showToast(err.message) },
    );
  };

  const handleStatusChange = (status: 'en_attente' | 'rembourse') => {
    setLocalStatus(status);
    setStatus.mutate({ id: tx.id, status }, { onError: (err) => showToast(err.message) });
  };

  const handleTxSelect = (txId: string) => {
    setSelectedTxId(txId);
    const found = incomeTransactions.find((inc) => inc.id === Number.parseInt(txId));
    if (found) {
      const defaultAmount = found.remaining_reimbursable ?? found.amount;
      setAttributedAmount(defaultAmount.toFixed(2));
    } else {
      setAttributedAmount('');
    }
  };

  const handleLink = () => {
    if (!selectedTxId) return;
    const parsed = Number.parseFloat(attributedAmount);
    const isPartial =
      selectedTx != null && Number.isFinite(parsed) && parsed < selectedTx.amount - 0.001;
    link.mutate(
      {
        linkedTxId: Number.parseInt(selectedTxId),
        attributedAmount: isPartial ? parsed : undefined,
      },
      {
        onSuccess: () => {
          setSelectedTxId('');
          setAttributedAmount('');
          setShowAdd(false);
          showToast(t('reimbursements_panel.link_success'));
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  const handleUnlink = (linkedId: number) => {
    unlink.mutate(linkedId, {
      onError: (err) => showToast(err.message),
    });
  };

  const handleUpdateAmount = (linkedId: number, amount: number | null) => {
    updateAmount.mutate({ linkedId, amount }, { onError: (err) => showToast(err.message) });
  };

  return (
    <div className="border-t border-line-subtle pt-4 mt-1">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-medium uppercase tracking-widest text-content-subtle">
          {t('reimbursements_panel.label')}
        </p>
        <button
          type="button"
          onClick={handleToggle}
          disabled={setStatus.isPending}
          className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg transition-all ${
            localStatus === null
              ? 'text-content-subtle hover:text-content-secondary hover:bg-surface-muted'
              : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
          }`}
        >
          {localStatus === null
            ? t('reimbursements_panel.activate')
            : t('reimbursements_panel.active')}
        </button>
      </div>

      {localStatus !== null && (
        <div className="space-y-3">
          {/* Statut */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleStatusChange('en_attente')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                localStatus === 'en_attente'
                  ? 'bg-warning-surface border-warning/30 text-warning'
                  : 'bg-surface-muted border-line text-content-subtle hover:bg-surface-emphasis'
              }`}
            >
              {t('reimbursements_panel.pending')}
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange('rembourse')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                localStatus === 'rembourse'
                  ? 'bg-success-surface border-success/30 text-success'
                  : 'bg-surface-muted border-line text-content-subtle hover:bg-surface-emphasis'
              }`}
            >
              {t('reimbursements_panel.done')}
            </button>
          </div>

          {/* Remboursements liés */}
          {reimbursements.length > 0 && (
            <div className="space-y-1.5">
              {reimbursements.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 px-3 py-2 bg-surface-muted rounded-lg border border-line-subtle"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-content-secondary truncate">
                      {r.description}
                    </p>
                    <p className="text-[11px] text-content-subtle">
                      {r.subcategory || r.category} · {fmtDate(r.date)}
                    </p>
                  </div>
                  <AmountCell
                    reimbursement={r}
                    onSave={(amount) => handleUpdateAmount(r.id, amount)}
                  />
                  <button
                    type="button"
                    onClick={() => handleUnlink(r.id)}
                    disabled={unlink.isPending}
                    className="text-content-faint hover:text-danger transition-colors text-base leading-none px-1 shrink-0"
                    title={t('reimbursements_panel.unlink_title')}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Reste à charge */}
          <div className="flex items-center justify-between px-3 py-2 bg-surface-muted rounded-lg border border-line-subtle">
            <span className="text-[11px] font-medium uppercase tracking-wider text-content-subtle">
              {t('reimbursements_panel.remaining_label')}
            </span>
            <span
              className={`text-sm font-medium tabular-nums ${remaining > 0 ? 'text-danger' : 'text-success'}`}
            >
              {fmtDec(Math.max(0, remaining))}
              <span className="text-[11px] text-content-subtle font-normal ml-1">
                / {fmtDec(tx.amount)}
              </span>
            </span>
          </div>

          {/* Lier un remboursement */}
          {showAdd ? (
            <div className="space-y-2">
              <FormGroup label={t('reimbursements_panel.income_tx')}>
                <Select value={selectedTxId} onChange={(e) => handleTxSelect(e.target.value)}>
                  <option value="">{t('reimbursements_panel.choose')}</option>
                  {incomeTransactions.map((inc) => {
                    const remaining = inc.remaining_reimbursable ?? inc.amount;
                    const isPartial = remaining < inc.amount - 0.001;
                    return (
                      <option key={inc.id} value={inc.id}>
                        {inc.description} · {fmtDate(inc.date)} ·{' '}
                        {isPartial
                          ? `+${fmtDec(remaining)} / ${fmtDec(inc.amount)}`
                          : `+${fmtDec(inc.amount)}`}
                      </option>
                    );
                  })}
                </Select>
              </FormGroup>
              {selectedTx != null && (
                <FormGroup label={t('reimbursements_panel.attributed_amount')}>
                  <DecimalInput
                    value={attributedAmount}
                    onChange={(e) => setAttributedAmount(e.target.value)}
                  />
                </FormGroup>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleLink}
                  disabled={!selectedTxId || link.isPending}
                >
                  {t('reimbursements_panel.link_btn')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setShowAdd(false);
                    setSelectedTxId('');
                    setAttributedAmount('');
                  }}
                >
                  {tc('cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg text-content-subtle hover:text-content-secondary hover:bg-surface-muted transition-all"
            >
              {t('reimbursements_panel.add_reimbursement')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
