import { useState } from 'react';

import { Button, FormGroup, Select, showToast } from '@/components/ui';
import { useTransactions } from '@/hooks/useTransactions';
import { fmtDate, fmtDec } from '@/lib/format';
import type { Transaction } from '@/types';

import {
  useLinkReimbursement,
  useReimbursements,
  useSetReimbursementStatus,
  useUnlinkReimbursement,
} from '../hooks/useReimbursements';

interface Props {
  tx: Transaction;
}

export function ReimbursementsPanel({ tx }: Readonly<Props>) {
  const [localStatus, setLocalStatus] = useState<'en_attente' | 'rembourse' | null>(
    tx.reimbursement_status,
  );
  const [showAdd, setShowAdd] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState('');

  const { data: reimbursements = [] } = useReimbursements(tx.id);
  const { data: incomeResult } = useTransactions({ type: 'income', limit: 500 });
  const incomeTransactions = (incomeResult?.data ?? []).filter(
    (t) => !reimbursements.some((r) => r.id === t.id),
  );

  const setStatus = useSetReimbursementStatus();
  const link = useLinkReimbursement(tx.id);
  const unlink = useUnlinkReimbursement(tx.id);

  const totalReimbursed = reimbursements.reduce((s, r) => s + r.amount, 0);
  const remaining = tx.amount - totalReimbursed;

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

  const handleLink = () => {
    if (!selectedTxId) return;
    link.mutate(Number.parseInt(selectedTxId), {
      onSuccess: () => {
        setSelectedTxId('');
        setShowAdd(false);
        showToast('Remboursement lié ✓');
      },
      onError: (err) => showToast(err.message),
    });
  };

  const handleUnlink = (linkedId: number) => {
    unlink.mutate(linkedId, {
      onError: (err) => showToast(err.message),
    });
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
            localStatus !== null
              ? 'bg-teal-50 text-teal-700 hover:bg-teal-100'
              : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'
          }`}
        >
          {localStatus !== null ? '↩ Actif' : 'Activer'}
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
                  className="flex items-center gap-2 px-3 py-2 bg-stone-50 rounded-lg border border-black/[0.06]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-stone-700 truncate">{r.description}</p>
                    <p className="text-[11px] text-stone-400">
                      {r.subcategory || r.category} · {fmtDate(r.date)}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-green-700 tabular-nums shrink-0">
                    +{fmtDec(r.amount)}
                  </span>
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
          <div className="flex items-center justify-between px-3 py-2 bg-stone-50 rounded-lg border border-black/[0.06]">
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
          {!showAdd ? (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-50 transition-all"
            >
              + Lier un remboursement
            </button>
          ) : (
            <div className="flex gap-2 items-end">
              <FormGroup label="Transaction de revenu" className="flex-1">
                <Select value={selectedTxId} onChange={(e) => setSelectedTxId(e.target.value)}>
                  <option value="">— Choisir —</option>
                  {incomeTransactions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.description} · {fmtDate(t.date)} · +{fmtDec(t.amount)}
                    </option>
                  ))}
                </Select>
              </FormGroup>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleLink}
                disabled={!selectedTxId || link.isPending}
              >
                Lier
              </Button>
              <Button type="button" size="sm" onClick={() => setShowAdd(false)}>
                Annuler
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
