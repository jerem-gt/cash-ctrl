import { ArrowLeftRight, Check, Loader2, MoreHorizontal, StickyNote } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ItemActions } from '@/components/ItemActions';
import { Badge } from '@/components/ui';
import { AccountBadge } from '@/features/accounts/components/AccountBadge';
import { useCategories } from '@/hooks/useCategories.ts';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useValidateTransaction } from '@/hooks/useTransactions';
import { currentLocale, fmtDec, today } from '@/lib/format';
import type { Account, Transaction } from '@/types';

const CURRENT_YEAR = new Date().getFullYear();

interface Props {
  tx: Transaction;
  accounts?: Account[];
  logoMap?: Record<string, string | null>;
  runningBalance?: number;
  readOnly?: boolean;
  onEdit?: (tx: Transaction) => void;
  onDuplicate?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
}

function getTxClasses(isFuture: boolean, validated: boolean, type: Transaction['type']) {
  const stateClass =
    isFuture && !validated
      ? 'bg-info-surface border-info/30 hover:border-info/30'
      : 'bg-surface border-line-subtle hover:border-line';
  const rowClass = validated ? 'bg-surface border-success/30 hover:border-success/30' : stateClass;
  const typeColor = type === 'income' ? 'text-success' : 'text-danger';
  const dimmedColor = type === 'income' ? 'text-success/50' : 'text-danger/50';
  const amountColor = validated ? typeColor : dimmedColor;
  return { rowClass, amountColor };
}

function TxDateBlock({ date }: Readonly<{ date: string }>) {
  const d = new Date(date);
  const isCurrentYear = d.getFullYear() === CURRENT_YEAR;
  return (
    <div className="flex flex-col items-center justify-center shrink-0 w-10 py-1 border-r border-line-subtle pr-3">
      <span className="text-[9px] uppercase font-bold text-content-subtle leading-none tracking-tighter">
        {new Intl.DateTimeFormat(currentLocale(), { month: 'short' }).format(d).replace('.', '')}
      </span>
      <span className="text-sm font-bold text-content-secondary leading-none mt-0.5">
        {new Intl.DateTimeFormat(currentLocale(), { day: '2-digit' }).format(d)}
      </span>
      {!isCurrentYear && (
        <span className="text-[8px] text-content-subtle leading-none mt-0.5">
          {d.getFullYear()}
        </span>
      )}
    </div>
  );
}

function TxMobileMenu({
  tx,
  onEdit,
  onDuplicate,
  onDelete,
}: Readonly<Pick<Props, 'tx' | 'onEdit' | 'onDuplicate' | 'onDelete'>>) {
  const { t } = useTranslation('transactions');
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setMenuOpen(false));
  if (onEdit == null && onDuplicate == null && onDelete == null) return null;
  return (
    <div ref={ref} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="p-1.5 text-content-faint hover:text-content-secondary hover:bg-surface-emphasis rounded-md transition-colors"
        aria-label={t('tx_item.actions')}
      >
        <MoreHorizontal size={15} />
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-8 z-20 bg-surface border border-line rounded-xl shadow-lg py-1 min-w-32 text-sm">
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                onEdit(tx);
                setMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-surface-muted text-content-secondary transition-colors"
            >
              {t('tx_item.edit')}
            </button>
          )}
          {onDuplicate && (
            <button
              type="button"
              onClick={() => {
                onDuplicate(tx);
                setMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-surface-muted text-content-secondary transition-colors"
            >
              {t('tx_item.duplicate')}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(tx);
                setMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-danger-surface text-danger transition-colors"
            >
              {t('tx_item.delete')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TxItemBody({
  tx,
  validated,
  isScheduled,
  isFuture,
  isTransfer,
  accounts,
  logoMap,
  logo,
}: Readonly<
  Pick<Props, 'tx' | 'accounts' | 'logoMap'> & {
    validated: boolean;
    isScheduled: boolean;
    isFuture: boolean;
    isTransfer: boolean;
    logo: string | null;
  }
>) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-0.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <p
            className={`text-sm truncate font-semibold min-w-0 ${validated ? 'text-content-secondary' : 'text-content-subtle'}`}
          >
            {tx.description}
          </p>
          <TxIndicators tx={tx} isScheduled={isScheduled} isTransfer={isTransfer} />
        </div>
        {/* Desktop : badges sur la ligne du titre */}
        <div className="hidden sm:flex shrink-0">
          <TxBadges tx={tx} validated={validated} isFuture={isFuture} />
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <TxMeta tx={tx} accounts={accounts} logoMap={logoMap} logo={logo} />
        {/* Mobile : badges renvoyés sous la description pour ne pas l'écraser */}
        <div className="flex sm:hidden">
          <TxBadges tx={tx} validated={validated} isFuture={isFuture} />
        </div>
      </div>
    </div>
  );
}

// Indicateurs d'état discrets : un seul langage (lucide), monochrome gris.
function TxIndicators({
  tx,
  isScheduled,
  isTransfer,
}: Readonly<Pick<Props, 'tx'> & { isScheduled: boolean; isTransfer: boolean }>) {
  const { t } = useTranslation('transactions');
  if (!isScheduled && !isTransfer && !tx.notes) return null;
  return (
    <span className="flex items-center gap-1 shrink-0 text-content-subtle">
      {isScheduled && (
        <span
          title={t('tx_item.scheduled_title')}
          className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0"
        />
      )}
      {isTransfer && (
        <span title={t('tx_item.transfer_title')}>
          <ArrowLeftRight size={12} />
        </span>
      )}
      {tx.notes && (
        <span title={tx.notes}>
          <StickyNote size={12} />
        </span>
      )}
    </span>
  );
}

function TxBadges({
  tx,
  validated,
  isFuture,
}: Readonly<Pick<Props, 'tx'> & { validated: boolean; isFuture: boolean }>) {
  const { t } = useTranslation('transactions');
  return (
    <div className="flex gap-1 shrink-0">
      {isFuture && !validated && <Badge variant="brand">{t('tx_item.upcoming')}</Badge>}
      {tx.reimbursement_status === 'en_attente' && (
        <Badge variant="amber">{t('tx_item.pending')}</Badge>
      )}
      {tx.reimbursement_status === 'rembourse' && (
        <Badge variant="green">{t('tx_item.reimbursed')}</Badge>
      )}
    </div>
  );
}

function TxMeta({
  tx,
  accounts,
  logoMap,
  logo,
}: Readonly<Pick<Props, 'tx' | 'accounts' | 'logoMap'> & { logo: string | null }>) {
  const { t } = useTranslation('transactions');
  return (
    <p className="text-[11px] text-content-subtle flex items-center gap-1.5 flex-wrap">
      <span className="truncate text-content-muted font-medium">
        {tx.splits?.length ? t('tx_item.ventilated', { count: tx.splits.length }) : tx.subcategory}
      </span>
      {accounts && logoMap && (
        <>
          <span className="opacity-30">·</span>
          <AccountBadge name={tx.account_name ?? ''} logo={logo} />
        </>
      )}
    </p>
  );
}

function TxItemTrailing({
  tx,
  amountColor,
  validated,
  runningBalance,
  readOnly,
  onEdit,
  onDuplicate,
  onDelete,
}: Readonly<
  Pick<Props, 'tx' | 'runningBalance' | 'onEdit' | 'onDuplicate' | 'onDelete'> & {
    amountColor: string;
    validated: boolean;
    readOnly: boolean;
  }
>) {
  const { t } = useTranslation('transactions');
  const editCb = onEdit ? () => onEdit(tx) : undefined;
  const dupCb = onDuplicate ? () => onDuplicate(tx) : undefined;
  const delCb = onDelete ? () => onDelete(tx) : undefined;
  const sign = tx.type === 'income' ? '+' : '−';
  return (
    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
      {/* Contrôles placés AVANT le montant : les actions desktop (cachées au
          repos) occupent un espace qui se fond dans le blanc de la description,
          au lieu de laisser un trou en bout de ligne. Le montant reste épinglé
          à droite et ne bouge donc jamais au survol. */}
      <div className="flex items-center gap-0">
        <div className="hidden sm:flex sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
          <ItemActions onEdit={editCb} onDuplicate={dupCb} onDelete={delCb} />
        </div>
        {!readOnly && (
          <TxMobileMenu tx={tx} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
        )}
        {!readOnly && <ValidateButton tx={tx} validated={validated} />}
      </div>

      <div className="text-right w-28 shrink-0 border-l border-line-subtle pl-2 sm:pl-3">
        <div className={`text-sm font-bold tabular-nums ${amountColor}`}>
          {sign}
          {fmtDec(tx.amount)}
        </div>
        {runningBalance != null && (
          <div
            className="text-[10px] text-content-subtle tabular-nums leading-tight"
            title={t('tx_item.running_balance_title')}
          >
            {fmtDec(runningBalance)}
          </div>
        )}
      </div>
    </div>
  );
}

function ValidateButton({ tx, validated }: Readonly<Pick<Props, 'tx'> & { validated: boolean }>) {
  const { t } = useTranslation('transactions');
  const validate = useValidateTransaction();
  const colorClass = validated ? 'text-success' : 'text-content-faint hover:bg-surface-emphasis';
  return (
    <button
      onClick={() => validate.mutate({ id: tx.id, validated: !validated })}
      disabled={validate.isPending}
      className={`p-1.5 rounded-md transition-colors ${colorClass} disabled:opacity-50 disabled:cursor-not-allowed`}
      title={validated ? t('tx_item.unvalidate_title') : t('tx_item.validate_title')}
    >
      {validate.isPending ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Check size={15} strokeWidth={2.5} />
      )}
    </button>
  );
}

function TxItemBase({
  tx,
  accounts,
  logoMap,
  runningBalance,
  readOnly = false,
  onEdit,
  onDuplicate,
  onDelete,
}: Readonly<Props>) {
  const isTransfer = tx.transfer_peer_id !== null;
  const isScheduled = tx.scheduled_id !== null;
  const isFuture = tx.date > today();
  const validated = !!tx.validated;
  const account = accounts?.find((a) => a.id === tx.account_id);
  const logo = account?.bank ? (logoMap?.[account.bank] ?? null) : null;
  const { data: categories = [] } = useCategories();

  const category = categories.find((c) => c.id === tx.category_id);
  const { rowClass, amountColor } = getTxClasses(isFuture, validated, tx.type);

  return (
    <div
      title={tx.notes || undefined}
      className={`group flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 border-b border-line-subtle transition-colors ${rowClass}`}
    >
      <TxDateBlock date={tx.date} />

      <span
        title={category?.name || undefined}
        className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-surface-muted border border-line-subtle text-base leading-none cursor-default select-none"
      >
        {category?.icon ?? ''}
      </span>

      <TxItemBody
        tx={tx}
        validated={validated}
        isScheduled={isScheduled}
        isFuture={isFuture}
        isTransfer={isTransfer}
        accounts={accounts}
        logoMap={logoMap}
        logo={logo}
      />

      <TxItemTrailing
        tx={tx}
        amountColor={amountColor}
        validated={validated}
        runningBalance={runningBalance}
        readOnly={readOnly}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    </div>
  );
}

// Mémoïsé : évite de re-rendre toutes les lignes quand le parent se re-rend
// (validation d'une autre ligne, pagination, etc.). Seules les lignes dont les
// props changent réellement sont recalculées. Suppose des callbacks stables côté
// parent (cf. useTransactionsManager).
export const TxItem = memo(TxItemBase);
