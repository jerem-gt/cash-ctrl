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

  const typeColor = sched.type === 'income' ? 'text-success' : 'text-danger';
  const amountColor = isTransfer || isVersement ? 'text-content-muted' : typeColor;
  const typeSign = sched.type === 'income' ? '+' : '−';
  const amountSign = isTransfer || isVersement ? '' : typeSign;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-line-subtle last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{sched.description}</p>
          {isTransfer && (
            <span className="text-[10px] bg-info-surface text-info border border-info/30 rounded px-1.5 py-0.5 font-medium shrink-0">
              {t('row.transfer_badge')}
            </span>
          )}
          {isVersement && (
            <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30 rounded px-1.5 py-0.5 font-medium shrink-0">
              {t('row.versement_badge')}
            </span>
          )}
          {!sched.active && (
            <span className="text-[10px] bg-surface-emphasis text-content-subtle border border-line rounded px-1.5 py-0.5 font-medium shrink-0">
              {t('row.suspended_badge')}
            </span>
          )}
          {sched.transaction_count > 0 && (
            <button
              type="button"
              onClick={() => onViewTransactions(sched)}
              className="text-[10px] bg-surface-muted text-content-muted border border-line rounded px-1.5 py-0.5 font-medium shrink-0 hover:bg-surface-emphasis hover:text-content-secondary transition-colors"
            >
              {sched.transaction_count} tx
            </button>
          )}
        </div>
        <p className="text-[11px] text-content-subtle mt-0.5">
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
