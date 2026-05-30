import { useTranslation } from 'react-i18next';

import { ItemActions } from '@/components/ItemActions';
import { recurrenceLabel } from '@/features/scheduled/lib/recurrence';
import { fmtDec } from '@/lib/format';
import type { ScheduledTransaction } from '@/types';

interface RowProps {
  sched: ScheduledTransaction;
  accounts: { id: number; name: string }[];
  onEdit: (s: ScheduledTransaction) => void;
  onDelete: (s: ScheduledTransaction) => void;
  onViewTransactions: (s: ScheduledTransaction) => void;
}

export function ScheduledRow({
  sched,
  accounts,
  onEdit,
  onDelete,
  onViewTransactions,
}: Readonly<RowProps>) {
  const { t } = useTranslation('scheduled');
  const isVersement = sched.insurance_support_id != null;
  const isTransfer = !isVersement && sched.to_account_id != null;
  const toAccount = isTransfer ? accounts.find((a) => a.id === sched.to_account_id) : null;
  const sourceAccount = isVersement ? accounts.find((a) => a.id === sched.to_account_id) : null;

  const typeColor = sched.type === 'income' ? 'text-green-800' : 'text-red-700';
  const amountColor = isTransfer || isVersement ? 'text-stone-500' : typeColor;
  const typeSign = sched.type === 'income' ? '+' : '−';
  const amountSign = isTransfer || isVersement ? '' : typeSign;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-black/6 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{sched.description}</p>
          {isTransfer && (
            <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5 font-medium shrink-0">
              {t('row.transfer_badge')}
            </span>
          )}
          {isVersement && (
            <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-200 rounded px-1.5 py-0.5 font-medium shrink-0">
              {t('row.versement_badge')}
            </span>
          )}
          {!sched.active && (
            <span className="text-[10px] bg-stone-100 text-stone-400 border border-stone-200 rounded px-1.5 py-0.5 font-medium shrink-0">
              {t('row.suspended_badge')}
            </span>
          )}
          {sched.transaction_count > 0 && (
            <button
              type="button"
              onClick={() => onViewTransactions(sched)}
              className="text-[10px] bg-stone-50 text-stone-500 border border-stone-200 rounded px-1.5 py-0.5 font-medium shrink-0 hover:bg-stone-100 hover:text-stone-700 transition-colors"
            >
              {sched.transaction_count} tx
            </button>
          )}
        </div>
        <p className="text-[11px] text-stone-400 mt-0.5">
          {recurrenceLabel(sched, t)} · {sched.account_name}
          {isTransfer && toAccount ? ` → ${toAccount.name}` : ''}
          {isVersement && sched.insurance_support_name ? ` · ${sched.insurance_support_name}` : ''}
          {isVersement && sourceAccount
            ? ` · ${t('row.from_label', { name: sourceAccount.name })}`
            : ''}
          {sched.end_date ? ` · ${t('row.until_label', { date: sched.end_date })}` : ''}
        </p>
      </div>
      <span className={`text-sm font-medium tabular-nums shrink-0 ${amountColor}`}>
        {amountSign}
        {fmtDec(sched.amount)}
      </span>
      <ItemActions onEdit={() => onEdit(sched)} onDelete={() => onDelete(sched)} />
    </div>
  );
}
