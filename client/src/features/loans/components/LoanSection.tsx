import type { Account, LoanInstallment } from '@cashctrl/types';
import { Check, Pencil, Settings, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, DecimalInput, showToast } from '@/components/ui';
import { LoanFormModal } from '@/features/loans/components/LoanFormModal';
import {
  useLoan,
  useLoanInstallments,
  useUpdateInstallment,
} from '@/features/loans/hooks/useLoans';
import { today } from '@/lib/dateUtils';
import { currentLocale, fmtCurrency, fmtDate } from '@/lib/format';

type Props = {
  account: Account;
  onClose: () => void;
  readOnly?: boolean;
};

function LoanStat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-content-subtle">
        {label}
      </span>
      <span className="font-display text-lg text-content">{value}</span>
    </div>
  );
}

const STATUS_COLORS = {
  paid: 'bg-success-surface text-success border-success/30',
  pending: 'bg-warning-surface text-warning border-warning/30',
  planned: 'bg-surface-muted text-content-subtle border-line',
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
  const { t } = useTranslation('loans');
  const { t: tc } = useTranslation('common');
  const [editing, setEditing] = useState(false);
  const [dueDate, setDueDate] = useState(inst.due_date);
  const [amount, setAmount] = useState(inst.total_amount.toFixed(2));
  const updateInstallment = useUpdateInstallment(loanId);

  const isPaid = inst.transaction_validated === 1;
  const isGenerated = inst.transaction_id != null;
  const status = (isPaid && 'paid') || (isGenerated && 'pending') || 'planned';

  const statusLabels = {
    paid: t('section.status_paid'),
    pending: t('section.status_pending'),
    planned: t('section.status_planned'),
  };

  const handleSave = () => {
    const total = Number.parseFloat(amount);
    if (!dueDate || Number.isNaN(total) || total <= 0) {
      showToast(t('section.invalid_values'));
      return;
    }
    updateInstallment.mutate(
      { installmentId: inst.id, due_date: dueDate, total_amount: total },
      {
        onSuccess: () => setEditing(false),
      },
    );
  };

  const handleCancel = () => {
    setDueDate(inst.due_date);
    setAmount(inst.total_amount.toFixed(2));
    setEditing(false);
  };

  const statusBadge = (
    <span
      className={`text-[10px] rounded px-1.5 py-0.5 font-medium border ${STATUS_COLORS[status]}`}
    >
      {statusLabels[status]}
    </span>
  );

  if (editing) {
    return (
      <tr className="bg-surface-muted">
        <td className="px-3 py-2 text-xs text-content-muted">{inst.installment_number}</td>
        <td className="px-3 py-2">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="text-xs border border-line-strong rounded px-2 py-1 w-36"
          />
        </td>
        <td className="px-3 py-2">
          <DecimalInput
            aria-label={tc('amount')}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-xs border border-line-strong rounded px-2 py-1 w-28 text-right"
          />
        </td>
        <td className="px-3 py-2 text-xs text-content-subtle text-right">
          {fmtCurrency(inst.principal_amount)}
        </td>
        <td className="px-3 py-2 text-xs text-content-subtle text-right">
          {fmtCurrency(inst.interest_amount)}
        </td>
        <td className="px-3 py-2">{statusBadge}</td>
        <td className="px-3 py-2">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={updateInstallment.isPending}
              className="p-1.5 text-success hover:bg-success-surface rounded transition-colors"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1.5 text-content-subtle hover:bg-surface-emphasis rounded transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={isPast && !isPaid ? 'bg-danger-surface/40' : ''}>
      <td className="px-3 py-2 text-xs text-content-subtle">{inst.installment_number}</td>
      <td className="px-3 py-2 text-xs text-content-secondary">{fmtDate(inst.due_date)}</td>
      <td className="px-3 py-2 text-xs text-content text-right font-medium">
        {fmtCurrency(inst.total_amount)}
      </td>
      <td className="px-3 py-2 text-xs text-content-subtle text-right">
        {fmtCurrency(inst.principal_amount)}
      </td>
      <td className="px-3 py-2 text-xs text-content-subtle text-right">
        {fmtCurrency(inst.interest_amount)}
      </td>
      <td className="px-3 py-2">{statusBadge}</td>
      <td className="px-3 py-2">
        {!isPaid && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="p-1.5 text-content-subtle hover:text-content-secondary hover:bg-surface-emphasis rounded transition-colors"
          >
            <Pencil size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}

export function LoanSection({ account, onClose, readOnly = false }: Readonly<Props>) {
  const { t } = useTranslation('loans');
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

  const todayDate = today();
  const capitalPct = Math.min(100, Math.round((paidPrincipal / loan.principal_amount) * 100));
  const totalInterest = paidInterest + remainingInterest;
  const interestPct =
    totalInterest > 0 ? Math.min(100, Math.round((paidInterest / totalInterest) * 100)) : 0;

  return (
    <div className="space-y-5">
      {/* Résumé */}
      <div className="bg-surface-muted border border-line rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-[10px] font-medium uppercase tracking-widest text-content-subtle">
            {t('section.details_title')}
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 text-xs text-content-subtle hover:text-content-secondary transition-colors"
            >
              <Settings size={13} />
              {t('section.edit_btn')}
            </button>
          )}
        </div>

        {/* Ligne 1 — paramètres fixes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-5">
          <LoanStat
            label={t('section.capital_borrowed')}
            value={fmtCurrency(loan.principal_amount)}
          />
          <LoanStat
            label={t('section.annual_rate')}
            value={`${(loan.interest_rate * 100).toLocaleString(currentLocale(), { minimumFractionDigits: 2 })} %`}
          />
          <LoanStat
            label={t('section.duration')}
            value={t('section.duration_value', { months: loan.duration_months })}
          />
          <LoanStat
            label={t('section.monthly_payment')}
            value={fmtCurrency(loan.monthly_payment)}
          />
        </div>

        {/* Ligne 2 — suivi dynamique */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-line">
          {/* Capital */}
          <div>
            <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-content-subtle block mb-3">
              {t('section.capital_section')}
            </span>
            <div className="flex justify-between items-end mb-2">
              <div>
                <span className="text-[10px] text-content-subtle block mb-0.5">
                  {t('section.repaid')}
                </span>
                <span className="font-display text-lg text-content">
                  {fmtCurrency(paidPrincipal)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-content-subtle block mb-0.5">
                  {t('section.remaining_due')}
                </span>
                <span className="font-display text-lg text-danger">
                  {fmtCurrency(capitalRestantDu)}
                </span>
              </div>
            </div>
            <div className="h-1.5 bg-surface-emphasis rounded-full overflow-hidden">
              <div
                className="h-full bg-surface-strong rounded-full transition-all"
                style={{ width: `${capitalPct}%` }}
              />
            </div>
            <p className="text-[10px] text-content-faint mt-1 text-right">{capitalPct} %</p>
          </div>

          {/* Intérêts */}
          <div>
            <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-content-subtle block mb-3">
              {t('section.interest_section')}
            </span>
            <div className="flex justify-between items-end mb-2">
              <div>
                <span className="text-[10px] text-content-subtle block mb-0.5">
                  {t('section.paid')}
                </span>
                <span className="font-display text-lg text-content">
                  {fmtCurrency(paidInterest)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-content-subtle block mb-0.5">
                  {t('section.remaining')}
                </span>
                <span className="font-display text-lg text-content">
                  {fmtCurrency(remainingInterest)}
                </span>
              </div>
            </div>
            <div className="h-1.5 bg-surface-emphasis rounded-full overflow-hidden">
              <div
                className="h-full bg-warning rounded-full transition-all"
                style={{ width: `${interestPct}%` }}
              />
            </div>
            <p className="text-[10px] text-content-faint mt-1 text-right">{interestPct} %</p>
          </div>
        </div>
      </div>

      {/* Échéancier */}
      <div>
        <p className="text-[10px] font-medium uppercase tracking-widest text-content-subtle mb-3">
          {t('section.schedule_title', { count: installments.length })}
        </p>
        <div className="border border-line rounded-2xl overflow-hidden">
          <div className="overflow-x-auto max-h-120 overflow-y-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-surface-muted sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wide text-content-subtle font-medium">
                    {t('section.col_number')}
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wide text-content-subtle font-medium">
                    {t('section.col_due_date')}
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wide text-content-subtle font-medium">
                    {t('section.col_installment')}
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wide text-content-subtle font-medium">
                    {t('section.col_capital')}
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wide text-content-subtle font-medium">
                    {t('section.col_interest')}
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wide text-content-subtle font-medium">
                    {t('section.col_status')}
                  </th>
                  <th className="px-3 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {installments.map((inst) => (
                  <InstallmentRow
                    key={inst.id}
                    inst={inst}
                    loanId={loan.id}
                    isPast={inst.due_date < todayDate}
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
            {t('section.close_loan_btn')}
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
