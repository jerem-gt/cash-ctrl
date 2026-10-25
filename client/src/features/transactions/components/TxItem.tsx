import type { Account, Category, Transaction } from '@cashctrl/types';
import { ArrowLeftRight, Check, Loader2, MoreHorizontal, StickyNote } from 'lucide-react';
import { Fragment, memo, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ItemActions } from '@/components/ItemActions';
import { Badge } from '@/components/ui';
import { Popover } from '@/components/ui/popover';
import { AccountBadge } from '@/features/accounts/components/AccountBadge';
import {
  distinctSplitCategories,
  resolveSplitParts,
  type SplitPart,
} from '@/features/transactions/lib/splitParts';
import { useCategories } from '@/hooks/useCategories.ts';
import { useValidateTransaction } from '@/hooks/useTransactions';
import { parseLocalDate, today } from '@/lib/dateUtils';
import { fmtCurrency, fmtDayNum, fmtMonthShort } from '@/lib/format';

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

const currentYear = () => new Date().getFullYear();

function TxDateBlock({ date }: Readonly<{ date: string }>) {
  const d = parseLocalDate(date);
  const isCurrentYear = d.getFullYear() === currentYear();
  return (
    <div className="flex flex-col items-center justify-center shrink-0 w-10 py-1 border-r border-line-subtle pr-3">
      <span className="text-[9px] uppercase font-bold text-content-subtle leading-none tracking-tighter">
        {fmtMonthShort(d)}
      </span>
      <span className="text-sm font-bold text-content-secondary leading-none mt-0.5">
        {fmtDayNum(d)}
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
  const neutral = 'hover:bg-surface-muted text-content-secondary';
  const actions = [
    { key: 'edit', label: t('tx_item.edit'), run: onEdit, className: neutral },
    { key: 'duplicate', label: t('tx_item.duplicate'), run: onDuplicate, className: neutral },
    {
      key: 'delete',
      label: t('tx_item.delete'),
      run: onDelete,
      className: 'hover:bg-danger-surface text-danger',
    },
  ].filter((action) => action.run != null);
  if (actions.length === 0) return null;
  return (
    <div className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="p-1.5 text-content-faint hover:text-content-secondary hover:bg-surface-emphasis rounded-md transition-colors"
        aria-label={t('tx_item.actions')}
        aria-expanded={menuOpen}
      >
        <MoreHorizontal size={15} />
      </button>
      <Popover
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        className="absolute right-0 top-8 bg-surface border border-line rounded-xl shadow-lg py-1 min-w-32 text-sm"
      >
        {actions.map(({ key, label, run, className }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              run?.(tx);
              setMenuOpen(false);
            }}
            className={`w-full text-left px-3 py-2 transition-colors ${className}`}
          >
            {label}
          </button>
        ))}
      </Popover>
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
  parts,
}: Readonly<
  Pick<Props, 'tx' | 'accounts' | 'logoMap'> & {
    parts: readonly SplitPart[];
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

      {tx.notes && (
        <p className="sm:hidden text-[11px] text-content-subtle line-clamp-2">{tx.notes}</p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        <TxMeta tx={tx} parts={parts} accounts={accounts} logoMap={logoMap} logo={logo} />
        {/* Mobile : badges renvoyés sous la description pour ne pas l'écraser */}
        <div className="flex sm:hidden">
          <TxBadges tx={tx} validated={validated} isFuture={isFuture} />
        </div>
      </div>
      {parts.length > 1 && <SplitBar parts={parts} />}
    </div>
  );
}

// Pastille décorative (aria-hidden) accompagnée d'un libellé lisible par les lecteurs d'écran.
function TxIndicator({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <span title={label} className="flex items-center">
      <span aria-hidden="true" className="flex items-center">
        {children}
      </span>
      <span className="sr-only">{label}</span>
    </span>
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
        <TxIndicator label={t('tx_item.scheduled_title')}>
          <span className="block w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
        </TxIndicator>
      )}
      {isTransfer && (
        <TxIndicator label={t('tx_item.transfer_title')}>
          <ArrowLeftRight size={12} />
        </TxIndicator>
      )}
      {tx.notes && (
        <TxIndicator label={tx.notes}>
          <StickyNote size={12} />
        </TxIndicator>
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

// Rond d'icône : icône de la catégorie, ou icônes empilées pour une ventilée.
function TxCategoryIcon({
  category,
  parts,
}: Readonly<{ category?: Category; parts: readonly SplitPart[] }>) {
  const base =
    'relative shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-surface-muted border border-line-subtle text-base leading-none cursor-default select-none';
  const categories = distinctSplitCategories(parts);
  if (categories.length < 2) {
    const single = categories[0];
    return (
      <span title={single?.categoryName ?? (category?.name || undefined)} className={base}>
        {single?.categoryIcon ?? category?.icon ?? ''}
      </span>
    );
  }
  const extra = categories.length - 2;
  return (
    <span title={categories.map((c) => c.categoryName).join('\n')} className={base}>
      <span className="absolute top-0.5 left-1 text-[15px] leading-none">
        {categories[0].categoryIcon}
      </span>
      <span className="absolute bottom-0.5 right-1 text-[15px] leading-none">
        {categories[1].categoryIcon}
      </span>
      {extra > 0 && (
        <span className="absolute -bottom-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-surface border border-line-subtle text-[9px] font-bold leading-none text-content-secondary flex items-center justify-center">
          +{extra}
        </span>
      )}
    </span>
  );
}

// Sous-titre d'une ventilée : icône + sous-catégorie de chaque ligne, détail complet au survol.
function SplitSubtitle({ parts }: Readonly<{ parts: readonly SplitPart[] }>) {
  const { t } = useTranslation('transactions');
  const lines = parts.map(
    (p) => `${p.categoryName} / ${p.subcategoryName} : ${fmtCurrency(p.amount)}`,
  );
  return (
    <span
      className="truncate min-w-0 max-w-full text-content-muted font-medium"
      title={lines.join('\n')}
    >
      <span aria-hidden="true">
        {parts.map((p, i) => (
          <Fragment key={p.splitId}>
            {i > 0 && ' · '}
            {p.categoryIcon} {p.subcategoryName}
          </Fragment>
        ))}
      </span>
      <span className="sr-only">{t('tx_item.ventilated_prefix') + lines.join(', ')}</span>
    </span>
  );
}

// Barre de répartition décorative, découpée au prorata des montants.
function SplitBar({ parts }: Readonly<{ parts: readonly SplitPart[] }>) {
  return (
    <div
      aria-hidden="true"
      data-testid="split-bar"
      className="flex h-[3px] w-full mt-1 gap-px rounded-full overflow-hidden bg-surface"
    >
      {parts.map((p) => (
        <span
          key={p.splitId}
          data-testid="split-bar-segment"
          className="h-full min-w-px"
          style={{ flex: `${Math.abs(p.amount) || 1} 1 0%`, backgroundColor: p.color }}
        />
      ))}
    </div>
  );
}

function TxMeta({
  tx,
  parts,
  accounts,
  logoMap,
  logo,
}: Readonly<
  Pick<Props, 'tx' | 'accounts' | 'logoMap'> & { logo: string | null; parts: readonly SplitPart[] }
>) {
  const { t } = useTranslation('transactions');
  let subtitle: ReactNode;
  if (parts.length > 0) {
    subtitle = <SplitSubtitle parts={parts} />;
  } else {
    const label = tx.splits?.length
      ? t('tx_item.ventilated', { count: tx.splits.length })
      : tx.subcategory;
    subtitle = (
      <span className="truncate min-w-0 max-w-full text-content-muted font-medium">{label}</span>
    );
  }
  return (
    <p className="text-[11px] text-content-subtle flex items-center gap-1.5 flex-wrap min-w-0 max-w-full">
      {subtitle}
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
          {fmtCurrency(tx.amount)}
        </div>
        {runningBalance != null && (
          <div
            className="text-[10px] text-content-subtle tabular-nums leading-tight"
            title={t('tx_item.running_balance_title')}
          >
            {fmtCurrency(runningBalance)}
          </div>
        )}
      </div>
    </div>
  );
}

function ValidateButton({ tx, validated }: Readonly<Pick<Props, 'tx'> & { validated: boolean }>) {
  const { t } = useTranslation('transactions');
  const validate = useValidateTransaction();
  const validatedLabel = validated ? t('tx_item.unvalidate_title') : t('tx_item.validate_title');
  const colorClass = validated ? 'text-success' : 'text-content-faint hover:bg-surface-emphasis';
  return (
    <button
      type="button"
      onClick={() => validate.mutate({ id: tx.id, validated: !validated })}
      disabled={validate.isPending}
      className={`p-1.5 rounded-md transition-colors ${colorClass} disabled:opacity-50 disabled:cursor-not-allowed`}
      title={validatedLabel}
      aria-label={validatedLabel}
      aria-pressed={validated}
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
  const parts = tx.splits?.length ? resolveSplitParts(tx.splits, categories) : [];
  const { rowClass, amountColor } = getTxClasses(isFuture, validated, tx.type);

  return (
    <div
      title={tx.notes || undefined}
      className={`group flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 border-b border-line-subtle transition-colors ${rowClass}`}
    >
      <TxDateBlock date={tx.date} />

      <TxCategoryIcon category={category} parts={parts} />

      <TxItemBody
        tx={tx}
        parts={parts}
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
