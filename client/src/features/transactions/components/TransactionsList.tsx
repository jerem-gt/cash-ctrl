import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Empty, Pagination, Skeleton } from '@/components/ui';
import { EditStockOperationModal } from '@/features/portfolio/components/EditStockOperationModal';
import { DeleteTxModal } from '@/features/transactions/components/DeleteTxModal';
import { TxItem } from '@/features/transactions/components/TxItem';
import { TxModal } from '@/features/transactions/components/TxModal';
import { useTransactionsManager } from '@/features/transactions/hooks/useTransactionsManager';
import { computeRunningBalances } from '@/lib/balance';
import type { Account } from '@/types';

import { TransactionsFilters } from './TransactionsFilters';

interface Props {
  account?: Account;
  logoMap: Record<string, string | null>;
  emptyMessage?: string | undefined;
  readOnly?: boolean;
}

export function TransactionsList({
  account,
  logoMap,
  emptyMessage,
  readOnly = false,
}: Readonly<Props>) {
  const { t } = useTranslation('transactions');
  const { state, actions } = useTransactionsManager(account?.id);
  const resolvedEmptyMessage = emptyMessage ?? t('list.empty');

  const runningBalances = useMemo(() => {
    if (account == null) return [];
    const startingBalance =
      account.envelope_type === 'loan'
        ? (account.capital_restant_du_all ?? 0)
        : account.balance_all;
    return computeRunningBalances(
      state.transactions,
      startingBalance - (state.balance_before_page ?? 0),
    );
  }, [account, state.transactions, state.balance_before_page]);

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
        <div className="flex-1 min-w-0">
          <TransactionsFilters
            filters={state.filters}
            onFilterChange={actions.handleFilterChange}
            categories={state.categories}
            subcategories={state.activeSubcategories}
            accounts={state.accounts}
            paymentMethods={state.paymentMethods}
            logoMap={logoMap}
            showAccountSelect={!account}
          />
        </div>
        <div className="flex items-center justify-between sm:justify-start gap-3 sm:shrink-0 sm:h-9">
          <span className="text-xs text-stone-400">{t('list.count', { count: state.total })}</span>
          {!readOnly && (
            <Button variant="primary" onClick={actions.openAdd}>
              {t('list.add_btn')}
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {state.isLoading ? (
          // Le Skeleton s'affiche ici uniquement à la place des items
          Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 border rounded-xl border-black/[0.07] bg-white"
            >
              <Skeleton className="w-4 h-4 shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-2.5 w-2/5" />
              </div>
              <Skeleton className="w-14 h-3.5 shrink-0" />
            </div>
          ))
        ) : (
          <>
            {state.transactions.length === 0 && <Empty>{resolvedEmptyMessage}</Empty>}
            {state.transactions.map((t, i) => (
              <TxItem
                key={t.id}
                tx={t}
                accounts={account ? undefined : state.accounts}
                logoMap={logoMap}
                runningBalance={account == null ? undefined : runningBalances[i]}
                readOnly={readOnly}
                onEdit={readOnly ? undefined : actions.openEdit}
                onDuplicate={readOnly ? undefined : actions.openDuplicate}
                onDelete={readOnly ? undefined : actions.openDelete}
              />
            ))}
          </>
        )}
      </div>
      {(state.totalPages > 1 || state.total > 10) && (
        <Pagination
          page={state.page}
          totalPages={state.totalPages}
          total={state.total}
          limit={state.limit}
          onChange={actions.setPage}
          onLimitChange={actions.handleLimitChange}
        />
      )}

      {state.modal.type === 'add' && (
        <TxModal
          mode="create"
          accounts={state.accounts}
          logoMap={logoMap}
          categories={state.categories}
          paymentMethods={state.paymentMethods}
          fixedAccountId={account?.id}
          onClose={actions.closeAll}
        />
      )}
      {state.modal.type === 'duplicate' && (
        <TxModal
          mode="create"
          accounts={state.accounts}
          logoMap={logoMap}
          categories={state.categories}
          paymentMethods={state.paymentMethods}
          duplicateFrom={state.modal.tx}
          fixedAccountId={account?.id}
          onClose={actions.closeAll}
        />
      )}
      {state.modal.type === 'edit' &&
        (state.modal.tx.stock_operation ? (
          <EditStockOperationModal tx={state.modal.tx} onClose={actions.closeAll} />
        ) : (
          <TxModal
            mode="edit"
            tx={state.modal.tx}
            accounts={state.accounts}
            logoMap={logoMap}
            categories={state.categories}
            paymentMethods={state.paymentMethods}
            fixedAccountId={account?.id}
            onSave={actions.handleUpdate}
            onClose={actions.closeAll}
            isPending={state.isPending}
          />
        ))}
      {state.modal.type === 'delete' && (
        <DeleteTxModal
          tx={state.modal.tx}
          onConfirm={actions.handleDelete}
          onCancel={actions.closeAll}
          isPending={state.isPending}
        />
      )}
    </>
  );
}
