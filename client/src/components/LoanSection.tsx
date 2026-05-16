import { Check, Pencil, Settings, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { LoanFormModal } from '@/components/LoanFormModal';
import { Button, showToast } from '@/components/ui';
import { useLoan, useLoanInstallments, useUpdateInstallment } from '@/hooks/useLoans';
import { fmtDate, fmtDec } from '@/lib/format';
import type { Account, LoanInstallment } from '@/types';

type Props = {
  account: Account;
  onClose: () => void;
  readOnly?: boolean;
};

function LoanStat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-stone-400">
        {label}
      </span>
      <span className="font-sans text-lg text-stone-900">{value}</span>
    </div>
  );
}

const STATUS_CONFIG = {
  paid: { label: 'Payé', colors: 'bg-green-50 text-green-700 border-green-200' },
  pending: { label: 'En attente', colors: 'bg-amber-50 text-amber-700 border-amber-200' },
  planned: { label: 'Planifié', colors: 'bg-stone-50 text-stone-400 border-stone-200' },
};

function InstallmentRow({
  inst,
  loanId,
  isPast,
}: Readonly<{
  inst: LoanInstallment;
  loanId: number;
  isPast: boolean;
}>) {
  const [editing, setEditing] = useState(false);
  const [dueDate, setDueDate] = useState(inst.due_date);
  const [amount, setAmount] = useState(String(inst.total_amount));
  const updateInstallment = useUpdateInstallment(loanId);

  const isPaid = inst.transaction_validated === 1;
  const isGenerated = inst.transaction_id != null;
  const status = (isPaid && 'paid') || (isGenerated && 'pending') || 'planned';
  const config = STATUS_CONFIG[status];

  const handleSave = () => {
    const total = Number.parseFloat(amount);
    if (!dueDate || Number.isNaN(total) || total <= 0) {
      showToast('Valeurs invalides.');
      return;
    }
    updateInstallment.mutate(
      { installmentId: inst.id, due_date: dueDate, total_amount: total },
      {
        onSuccess: () => setEditing(false),
        onError: (e) => showToast(e.message),
      },
    );
  };

  const handleCancel = () => {
    setDueDate(inst.due_date);
    setAmount(String(inst.total_amount));
    setEditing(false);
  };

  const statusBadge = (
    <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium border ${config.colors}`}>
      {config.label}
    </span>
  );

  if (editing) {
    return (
      <tr className="bg-stone-50">
        <td className="px-3 py-2 text-xs text-stone-500">{inst.installment_number}</td>
        <td className="px-3 py-2">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="text-xs border border-stone-300 rounded px-2 py-1 w-36"
          />
        </td>
        <td className="px-3 py-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="0.01"
            min="0"
            className="text-xs border border-stone-300 rounded px-2 py-1 w-28 text-right"
          />
        </td>
        <td className="px-3 py-2 text-xs text-stone-400 text-right">
          {fmtDec(inst.principal_amount)}
        </td>
        <td className="px-3 py-2 text-xs text-stone-400 text-right">
          {fmtDec(inst.interest_amount)}
        </td>
        <td className="px-3 py-2">{statusBadge}</td>
        <td className="px-3 py-2">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={updateInstallment.isPending}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1.5 text-stone-400 hover:bg-stone-100 rounded transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={isPast && !isPaid ? 'bg-red-50/40' : ''}>
      <td className="px-3 py-2 text-xs text-stone-400">{inst.installment_number}</td>
      <td className="px-3 py-2 text-xs text-stone-700">{fmtDate(inst.due_date)}</td>
      <td className="px-3 py-2 text-xs text-stone-900 text-right font-medium">
        {fmtDec(inst.total_amount)}
      </td>
      <td className="px-3 py-2 text-xs text-stone-400 text-right">
        {fmtDec(inst.principal_amount)}
      </td>
      <td className="px-3 py-2 text-xs text-stone-400 text-right">
        {fmtDec(inst.interest_amount)}
      </td>
      <td className="px-3 py-2">{statusBadge}</td>
      <td className="px-3 py-2">
        {!isPaid && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded transition-colors"
          >
            <Pencil size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}

export function LoanSection({ account, onClose, readOnly = false }: Readonly<Props>) {
  const { data: loan, isLoading } = useLoan(account.id);
  const { data: installments = [] } = useLoanInstallments(loan?.id);
  const [editOpen, setEditOpen] = useState(false);

  const { capitalRestantDu, paidPrincipal, paidInterest, remainingInterest } = useMemo(() => {
    if (!loan)
      return { capitalRestantDu: 0, paidPrincipal: 0, paidInterest: 0, remainingInterest: 0 };
    const validated = installments.filter((i) => i.transaction_validated === 1);
    const pending = installments.filter((i) => i.transaction_validated !== 1);
    const paidCap = validated.reduce((sum, i) => sum + i.principal_amount, 0);
    const paidInt = validated.reduce((sum, i) => sum + i.interest_amount, 0);
    const remainInt = pending.reduce((sum, i) => sum + i.interest_amount, 0);
    return {
      capitalRestantDu: Math.max(0, loan.principal_amount - paidCap),
      paidPrincipal: paidCap,
      paidInterest: paidInt,
      remainingInterest: remainInt,
    };
  }, [loan, installments]);

  if (isLoading) return null;
  if (!loan) return null;

  const today = new Date().toISOString().slice(0, 10);
  const capitalPct = Math.min(100, Math.round((paidPrincipal / loan.principal_amount) * 100));
  const totalInterest = paidInterest + remainingInterest;
  const interestPct =
    totalInterest > 0 ? Math.min(100, Math.round((paidInterest / totalInterest) * 100)) : 0;

  return (
    <div className="space-y-5">
      {/* Résumé */}
      <div className="bg-[#fafaf9] border border-stone-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
            Détails du prêt
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-700 transition-colors"
            >
              <Settings size={13} />
              Modifier
            </button>
          )}
        </div>

        {/* Ligne 1 — paramètres fixes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-5">
          <LoanStat label="Capital emprunté" value={fmtDec(loan.principal_amount)} />
          <LoanStat
            label="Taux annuel"
            value={`${(loan.interest_rate * 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} %`}
          />
          <LoanStat label="Durée" value={`${loan.duration_months} mois`} />
          <LoanStat label="Mensualité" value={fmtDec(loan.monthly_payment)} />
        </div>

        {/* Ligne 2 — suivi dynamique */}
        <div className="grid grid-cols-2 gap-5 pt-4 border-t border-stone-200">
          {/* Capital */}
          <div>
            <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-stone-400 block mb-3">
              Capital
            </span>
            <div className="flex justify-between items-end mb-2">
              <div>
                <span className="text-[10px] text-stone-400 block mb-0.5">Remboursé</span>
                <span className="font-sans text-lg text-stone-900">{fmtDec(paidPrincipal)}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-stone-400 block mb-0.5">Restant dû</span>
                <span className="font-sans text-lg text-red-700">{fmtDec(capitalRestantDu)}</span>
              </div>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-stone-700 rounded-full transition-all"
                style={{ width: `${capitalPct}%` }}
              />
            </div>
            <p className="text-[10px] text-stone-300 mt-1 text-right">{capitalPct} %</p>
          </div>

          {/* Intérêts */}
          <div>
            <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-stone-400 block mb-3">
              Intérêts
            </span>
            <div className="flex justify-between items-end mb-2">
              <div>
                <span className="text-[10px] text-stone-400 block mb-0.5">Payés</span>
                <span className="font-sans text-lg text-stone-900">{fmtDec(paidInterest)}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-stone-400 block mb-0.5">Restants</span>
                <span className="font-sans text-lg text-stone-900">
                  {fmtDec(remainingInterest)}
                </span>
              </div>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all"
                style={{ width: `${interestPct}%` }}
              />
            </div>
            <p className="text-[10px] text-stone-300 mt-1 text-right">{interestPct} %</p>
          </div>
        </div>
      </div>

      {/* Échéancier */}
      <div>
        <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-3">
          Échéancier ({installments.length} mensualités)
        </p>
        <div className="border border-stone-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto max-h-120 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wide text-stone-400 font-medium">
                    #
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wide text-stone-400 font-medium">
                    Échéance
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wide text-stone-400 font-medium">
                    Mensualité
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wide text-stone-400 font-medium">
                    Capital
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wide text-stone-400 font-medium">
                    Intérêts
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wide text-stone-400 font-medium">
                    Statut
                  </th>
                  <th className="px-3 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {installments.map((inst) => (
                  <InstallmentRow
                    key={inst.id}
                    inst={inst}
                    loanId={loan.id}
                    isPast={inst.due_date < today}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {!account.closed_at && (
        <div className="flex justify-end pt-2">
          <Button variant="danger" size="sm" onClick={onClose}>
            Clôturer le prêt
          </Button>
        </div>
      )}

      {editOpen && (
        <LoanFormModal
          mode="edit"
          account={account}
          loan={loan}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}
