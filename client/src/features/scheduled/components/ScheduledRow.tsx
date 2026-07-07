import type { ScheduledTransaction } from '@cashctrl/types';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { ItemActions } from '@/components/ItemActions';
import { AccountBadge } from '@/features/accounts/components/AccountBadge';
import { recurrenceLabel } from '@/features/scheduled/lib/recurrence';
import { fmtCurrency } from '@/lib/format';

interface RowAccount {
  id: number;
  name: string;
  bank?: string | null;
}

interface RowProps {
  sched: ScheduledTransaction;
  accounts: RowAccount[];
  logoMap?: Record<string, string | null>;
  onEdit: (s: ScheduledTransaction) => void;
  onDelete: (s: ScheduledTransaction) => void;
  onViewTransactions: (s: ScheduledTransaction) => void;
  highlighted?: boolean;
  ref?: Ref<HTMLDivElement>;
}

function AccountChips({
  sched,
  accounts,
  logoMap,
  isTransfer,
  isVersement,
  toAccount,
  sourceAccount,
}: Readonly<{
  sched: ScheduledTransaction;
  accounts: RowAccount[];
  logoMap: Record<string, string | null>;
  isTransfer: boolean;
  isVersement: boolean;
  toAccount: RowAccount | null | undefined;
  sourceAccount: RowAccount | null | undefined;
}>) {
  const logoFor = (accountId: number | null | undefined): string | null => {
    if (accountId == null) return null;
    const acc = accounts.find((a) => a.id === accountId);
    return acc?.bank ? (logoMap[acc.bank] ?? null) : null;
  };

  const own = { id: sched.account_id, name: sched.account_name ?? '' };
  let primary = own;
  let secondary: RowAccount | null = null;

  if (isVersement && sourceAccount) {
    // Ordre voulu à l'affichage : compte source (débit) → compte AV/PER.
    primary = sourceAccount;
    secondary = own;
  } else if (isTransfer && toAccount) {
    secondary = toAccount;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap min-w-0 mt-0.5">
      <AccountBadge
        name={primary.name}
        logo={logoFor(primary.id)}
        className="max-w-[140px] sm:max-w-[220px] text-[11px] text-content-subtle"
      />
      {secondary && (
        <>
          <span aria-hidden="true" className="text-content-faint text-[10px] shrink-0">
            →
          </span>
          <AccountBadge
            name={secondary.name}
            logo={logoFor(secondary.id)}
            className="max-w-[140px] sm:max-w-[220px] text-[11px] text-content-subtle"
          />
        </>
      )}
    </div>
  );
}

export function ScheduledRow({
  sched,
  accounts,
  logoMap = {},
  onEdit,
  onDelete,
  onViewTransactions,
  highlighted = false,
  ref,
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
    <div
      ref={ref}
      className={`flex items-center gap-3 py-2.5 border-b border-line-subtle last:border-0 transition-all duration-300 ${
        highlighted ? 'ring-2 ring-brand-500 rounded-lg bg-brand-50/50 dark:bg-brand-500/10' : ''
      }`}
    >
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
        <AccountChips
          sched={sched}
          accounts={accounts}
          logoMap={logoMap}
          isTransfer={isTransfer}
          isVersement={isVersement}
          toAccount={toAccount}
          sourceAccount={sourceAccount}
        />
        <p className="text-[11px] text-content-subtle mt-0.5">
          {recurrenceLabel(sched, t)}
          {isVersement && sched.insurance_support_name ? ` · ${sched.insurance_support_name}` : ''}
          {sched.end_date ? ` · ${t('row.until_label', { date: sched.end_date })}` : ''}
        </p>
      </div>
      <span className={`text-sm font-medium tabular-nums shrink-0 ${amountColor}`}>
        {amountSign}
        {fmtCurrency(sched.amount)}
      </span>
      <ItemActions onEdit={() => onEdit(sched)} onDelete={() => onDelete(sched)} />
    </div>
  );
}
