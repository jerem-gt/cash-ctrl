import { DeleteTxModal } from '@/components/DeleteTxModal.tsx';
import { TxItem } from '@/components/TxItem';
import { TxModal } from '@/components/TxModal.tsx';
import { Button, Empty, Pagination, Skeleton } from '@/components/ui';
import { useTransactionsManager } from '@/hooks/useTransactionsManager.ts';
import type { Account } from '@/types';

import { TransactionsFilters } from './TransactionsFilters.tsx';

interface Props {
  account?: Account;
  logoMap: Record<string, string | null>;
  emptyMessage?: string;
}

export function TransactionsList({
  account,
  logoMap,
  emptyMessage = 'Aucune transaction trouvée',
}: Readonly<Props>) {
  const { state, actions } = useTransactionsManager(account?.id);

  if (state.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
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
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-3 flex-wrap items-center">
        {/* Filters */}
        <TransactionsFilters
          filters={state.filters}
          onFilterChange={actions.handleFilterChange}
          categories={state.categories}
          subcategories={state.activeSubcategories}
          accounts={state.accounts}
          logoMap={logoMap}
          showAccountSelect={!account}
        />
        <span className="text-xs text-stone-400 ml-auto">{state.total} transaction(s)</span>
        <Button variant="primary" onClick={actions.openAdd}>
          + Nouvelle transaction
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {state.transactions.length === 0 && <Empty>{emptyMessage}</Empty>}
        {state.transactions.map((t) => (
          <TxItem
            key={t.id}
            tx={t}
            accounts={account ? undefined : state.accounts}
            logoMap={logoMap}
            onEdit={actions.openEdit}
            onDuplicate={actions.openDuplicate}
            onDelete={actions.openDelete}
          />
        ))}
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
      {state.modal.type === 'edit' && (
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
      )}
      {state.modal.type === 'delete' && (
        <DeleteTxModal
          tx={state.modal.tx}
          onConfirm={actions.handleDelete}
          onCancel={actions.closeAll}
        />
      )}
    </>
  );
}
