import { Loader2, MoreHorizontal, StickyNote } from 'lucide-react';
import { useState } from 'react';

import { AccountBadge } from '@/components/AccountBadge';
import { ItemActions } from '@/components/ItemActions';
import { Badge } from '@/components/ui';
import { useCategories } from '@/hooks/useCategories.ts';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useValidateTransaction } from '@/hooks/useTransactions';
import { fmtDec, today } from '@/lib/format';
import type { Account, Category, PaymentMethod, Transaction } from '@/types';

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

function getTxIcons(
  tx: Transaction,
  categories: Category[],
  paymentMethods: PaymentMethod[],
): { catIcon: string; pmIcon: string } {
  if (!tx.payment_method) return { catIcon: '', pmIcon: '' };
  const catIcon = categories.find((m) => m.id === tx.category_id)?.icon ?? '';
  const pmIcon = paymentMethods.find((m) => m.name === tx.payment_method)?.icon ?? '';
  return { catIcon, pmIcon };
}

function getTxClasses(isFuture: boolean, validated: boolean, type: Transaction['type']) {
  const stateClass =
    isFuture && !validated
      ? 'bg-indigo-50/60 border-indigo-100 hover:border-indigo-200'
      : 'bg-white border-black/[0.07] hover:border-black/[0.13]';
  const rowClass = validated ? 'bg-white border-green-200 hover:border-green-300' : stateClass;
  const typeColor = type === 'income' ? 'text-green-800' : 'text-red-700';
  const dimmedColor = type === 'income' ? 'text-green-600/50' : 'text-red-500/50';
  const amountColor = validated ? typeColor : dimmedColor;
  return { rowClass, amountColor };
}

function TxDateBlock({ date }: Readonly<{ date: string }>) {
  const d = new Date(date);
  const isCurrentYear = d.getFullYear() === new Date().getFullYear();
  return (
    <div className="flex flex-col items-center justify-center shrink-0 w-10 py-1 border-r border-stone-100 pr-3">
      <span className="text-[9px] uppercase font-bold text-stone-400 leading-none tracking-tighter">
        {new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(d).replace('.', '')}
      </span>
      <span className="text-sm font-bold text-stone-700 leading-none mt-0.5">
        {new Intl.DateTimeFormat('fr-FR', { day: '2-digit' }).format(d)}
      </span>
      {!isCurrentYear && (
        <span className="text-[8px] text-stone-400 leading-none mt-0.5">{d.getFullYear()}</span>
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
  const [menuOpen, setMenuOpen] = useState(false);
  if (onEdit == null && onDuplicate == null && onDelete == null) return null;
  return (
    <div className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="p-1.5 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded-md transition-colors"
        aria-label="Actions"
      >
        <MoreHorizontal size={15} />
      </button>
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setMenuOpen(false);
            }}
          />
          <div className="absolute right-0 top-8 z-20 bg-white border border-stone-200 rounded-xl shadow-lg py-1 min-w-32 text-sm">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit(tx);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-stone-50 text-stone-700 transition-colors"
              >
                Modifier
              </button>
            )}
            {onDuplicate && (
              <button
                type="button"
                onClick={() => {
                  onDuplicate(tx);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-stone-50 text-stone-700 transition-colors"
              >
                Dupliquer
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(tx);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 transition-colors"
              >
                Supprimer
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function TxItem({
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
  const validate = useValidateTransaction();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const { data: categories = [] } = useCategories();

  const { catIcon, pmIcon } = getTxIcons(tx, categories, paymentMethods);
  const { rowClass, amountColor } = getTxClasses(isFuture, validated, tx.type);

  return (
    <div
      title={tx.notes || undefined}
      className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 border-b border-stone-100 transition-colors ${rowClass}`}
    >
      <TxDateBlock date={tx.date} />

      <span className="text-base leading-none shrink-0 w-5 text-center">{catIcon}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {isScheduled && (
            <span className="text-[12px] text-indigo-400 shrink-0" title="Transaction planifiée">
              ↻
            </span>
          )}
          {tx.notes && (
            <span title={tx.notes}>
              <StickyNote size={11} className="text-amber-400 shrink-0" />
            </span>
          )}
          <p
            className={`text-sm truncate font-semibold ${validated ? 'text-stone-700' : 'text-stone-400'}`}
          >
            {tx.description}
          </p>
          <div className="flex gap-1 shrink-0">
            {isFuture && !validated && (
              <Badge variant="indigo">{isScheduled ? '↻ À venir' : 'À venir'}</Badge>
            )}
            {isTransfer && <Badge variant="blue">↔</Badge>}
            {tx.reimbursement_status === 'en_attente' && <Badge variant="amber">En attente</Badge>}
          </div>
        </div>

        <p className="text-[11px] text-stone-400 flex items-center gap-1.5 flex-wrap">
          <span className="truncate text-stone-500 font-medium">
            {tx.splits?.length ? `Ventilée (${tx.splits.length})` : tx.subcategory}
          </span>
          {accounts && logoMap && (
            <>
              <span className="opacity-30">·</span>
              <AccountBadge name={tx.account_name ?? ''} logo={logo} />
            </>
          )}
          {tx.payment_method && (
            <>
              <span className="opacity-30">·</span>
              <span className="inline-flex items-center translate-y-[0.5px] text-[13px] leading-none">
                {pmIcon}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <div className="text-right min-w-18.75">
          <div className={`text-sm font-bold tabular-nums ${amountColor}`}>
            {tx.type === 'income' ? '+' : '−'}
            {fmtDec(tx.amount)}
          </div>
          {runningBalance != null && (
            <div
              className="text-[10px] text-stone-400 tabular-nums leading-tight"
              title="Solde courant"
            >
              {fmtDec(runningBalance)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0 border-l border-stone-100 pl-2">
          {!readOnly && (
            <button
              onClick={() => validate.mutate({ id: tx.id, validated: !validated })}
              disabled={validate.isPending}
              className={`p-1.5 rounded-md transition-colors ${validated ? 'text-green-500' : 'text-stone-300 hover:bg-stone-100'} disabled:opacity-50 disabled:cursor-not-allowed`}
              title={validated ? 'Marquer comme non validée' : 'Valider'}
            >
              {validate.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <span className="block scale-110">✓</span>
              )}
            </button>
          )}
          {!readOnly && (
            <TxMobileMenu tx={tx} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
          )}
          <div className="hidden sm:flex">
            <ItemActions
              onEdit={onEdit ? () => onEdit(tx) : undefined}
              onDuplicate={onDuplicate ? () => onDuplicate(tx) : undefined}
              onDelete={onDelete ? () => onDelete(tx) : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
