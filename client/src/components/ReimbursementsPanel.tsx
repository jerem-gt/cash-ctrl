import { type KeyboardEvent, useState } from 'react';

import { Button, DecimalInput, FormGroup, Select, showToast } from '@/components/ui';
import { useTransactions } from '@/hooks/useTransactions';
import { fmtDate, fmtDec } from '@/lib/format';
import type { Reimbursement, Transaction } from '@/types';

import {
  useLinkReimbursement,
  useReimbursements,
  useSetReimbursementStatus,
  useUnlinkReimbursement,
  useUpdateReimbursementAmount,
} from '../hooks/useReimbursements';

interface Props {
  tx: Transaction;
}

function AmountCell({
  reimbursement,
  onSave,
}: Readonly<{ reimbursement: Reimbursement; onSave: (amount: number | null) => void }>) {
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
          className="text-[11px] text-teal-600 hover:text-teal-800 font-bold leading-none"
        >
          ✓
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-[11px] text-stone-400 hover:text-stone-600 leading-none"
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
      title="Modifier le montant attribué"
    >
      <span className="text-xs font-medium text-green-700 tabular-nums group-hover:underline decoration-dotted">
        +{fmtDec(reimbursement.amount)}
      </span>
      {isPartial && (
        <span className="block text-[10px] text-stone-400 tabular-nums leading-none mt-0.5">
          / {fmtDec(reimbursement.transaction_amount)}
        </span>
      )}
    </button>
  );
}

export function ReimbursementsPanel({ tx }: Readonly<Props>) {
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

  const selectedTx = incomeTransactions.find((t) => t.id === Number.parseInt(selectedTxId));

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
    const found = incomeTransactions.find((t) => t.id === Number.parseInt(txId));
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
          showToast('Remboursement lié ✓');
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
    <div className="border-t border-black/[0.07] pt-4 mt-1">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-medium uppercase tracking-widest text-stone-400">
          Suivi remboursement
        </p>
        <button
          type="button"
          onClick={handleToggle}
          disabled={setStatus.isPending}
          className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg transition-all ${
            localStatus === null
              ? 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'
              : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
          }`}
        >
          {localStatus === null ? 'Activer' : '↩ Actif'}
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
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-stone-50 border-black/10 text-stone-400 hover:bg-stone-100'
              }`}
            >
              En attente
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange('rembourse')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                localStatus === 'rembourse'
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'bg-stone-50 border-black/10 text-stone-400 hover:bg-stone-100'
              }`}
            >
              Remboursement terminé
            </button>
          </div>

          {/* Remboursements liés */}
          {reimbursements.length > 0 && (
            <div className="space-y-1.5">
              {reimbursements.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 px-3 py-2 bg-stone-50 rounded-lg border border-black/6"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-stone-700 truncate">{r.description}</p>
                    <p className="text-[11px] text-stone-400">
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
                    className="text-stone-300 hover:text-red-400 transition-colors text-base leading-none px-1 shrink-0"
                    title="Délier"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Reste à charge */}
          <div className="flex items-center justify-between px-3 py-2 bg-stone-50 rounded-lg border border-black/6">
            <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
              Reste à charge
            </span>
            <span
              className={`text-sm font-medium tabular-nums ${remaining > 0 ? 'text-red-700' : 'text-green-700'}`}
            >
              {fmtDec(Math.max(0, remaining))}
              <span className="text-[11px] text-stone-400 font-normal ml-1">
                / {fmtDec(tx.amount)}
              </span>
            </span>
          </div>

          {/* Lier un remboursement */}
          {showAdd ? (
            <div className="space-y-2">
              <FormGroup label="Transaction de revenu">
                <Select value={selectedTxId} onChange={(e) => handleTxSelect(e.target.value)}>
                  <option value="">— Choisir —</option>
                  {incomeTransactions.map((t) => {
                    const remaining = t.remaining_reimbursable ?? t.amount;
                    const isPartial = remaining < t.amount - 0.001;
                    return (
                      <option key={t.id} value={t.id}>
                        {t.description} · {fmtDate(t.date)} ·{' '}
                        {isPartial
                          ? `+${fmtDec(remaining)} / ${fmtDec(t.amount)}`
                          : `+${fmtDec(t.amount)}`}
                      </option>
                    );
                  })}
                </Select>
              </FormGroup>
              {selectedTx != null && (
                <FormGroup label="Montant attribué">
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
                  Lier
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
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-50 transition-all"
            >
              + Lier un remboursement
            </button>
          )}
        </div>
      )}
    </div>
  );
}
