import { useMemo, useState } from 'react';

import { AccountSelect } from '@/components/AccountSelect';
import { DeleteTxModal } from '@/components/DeleteTxModal';
import { TransactionsList } from '@/components/TransactionsList';
import { type TxFormState, TxModal } from '@/components/TxModal';
import { Button, Pagination, Select, showToast } from '@/components/ui';
import { useAccounts } from '@/hooks/useAccounts';
import { useBanks } from '@/hooks/useBanks';
import { useCategories } from '@/hooks/useCategories';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import {
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
} from '@/hooks/useTransactions';
import type { Transaction, TransactionFilters } from '@/types';

type Filters = Omit<TransactionFilters, 'page' | 'limit'>;

export function TransactionsPage() {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: banks = [] } = useBanks();
  const logoMap = useMemo(() => Object.fromEntries(banks.map((b) => [b.name, b.logo])), [banks]);
  const { data: paymentMethods = [] } = usePaymentMethods();

  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const { data: result, isLoading } = useTransactions({ ...filters, page, limit });

  const updateTx = useUpdateTransaction();
  const deleteTxMutation = useDeleteTransaction();

  const [addOpen, setAddOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [duplicateTx, setDuplicateTx] = useState<Transaction | null>(null);
  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null);

  const setFilter = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const handleLimitChange = (l: number) => {
    setLimit(l);
    setPage(1);
  };

  const handleUpdate = (data: TxFormState) => {
    if (!editTx) return;
    const payload = editTx.transfer_peer_id
      ? {
          id: editTx.id,
          amount: Number.parseFloat(data.amount),
          description: data.description,
          date: data.date,
          type: editTx.type,
          account_id: editTx.account_id,
          category_id: editTx.category_id ?? categories[0]?.id ?? 0,
          payment_method_id: editTx.payment_method_id ?? 0,
          notes: editTx.notes,
          validated: !!editTx.validated,
          from_account_id: Number.parseInt(data.account_id) || undefined,
          to_account_id: Number.parseInt(data.to_account_id) || undefined,
        }
      : {
          id: editTx.id,
          type: data.type,
          amount: Number.parseFloat(data.amount),
          description: data.description,
          category_id: Number.parseInt(data.category_id) || (categories[0]?.id ?? 0),
          account_id: Number.parseInt(data.account_id),
          date: data.date,
          payment_method_id: Number.parseInt(data.payment_method_id),
          notes: data.notes || null,
          validated: data.validated,
        };
    updateTx.mutate(payload, {
      onSuccess: () => {
        setEditTx(null);
        showToast('Transaction modifiée ✓');
      },
      onError: (e) => showToast(e.message),
    });
  };

  const handleDelete = () => {
    if (!deleteTx) return;
    deleteTxMutation.mutate(deleteTx.id, {
      onSuccess: () => {
        setDeleteTx(null);
        showToast(deleteTx.transfer_peer_id ? 'Transfert supprimé' : 'Transaction supprimée');
      },
    });
  };

  const transactions = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-serif text-2xl tracking-tight">Transactions</h2>
          <p className="text-sm text-stone-400 mt-0.5">Gérez vos revenus et dépenses</p>
        </div>
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          + Nouvelle transaction
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-32.5 max-w-50">
          <AccountSelect
            id="filtered-account-select"
            value={String(filters.account_id ?? '')}
            onChange={(v) => setFilter({ account_id: v ? Number.parseInt(v) : undefined })}
            accounts={accounts}
            logoMap={logoMap}
            placeholder="Tous les comptes"
          />
        </div>
        <Select
          className="flex-1 min-w-32.5 max-w-50"
          value={String(filters.category_id ?? '')}
          onChange={(e) =>
            setFilter({ category_id: e.target.value ? Number.parseInt(e.target.value) : undefined })
          }
        >
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          className="flex-1 min-w-32.5 max-w-50"
          value={filters.type ?? ''}
          onChange={(e) =>
            setFilter({ type: (e.target.value || undefined) as 'income' | 'expense' | undefined })
          }
        >
          <option value="">Tous types</option>
          <option value="income">Revenus</option>
          <option value="expense">Dépenses</option>
        </Select>
        <span className="text-xs text-stone-400 ml-auto">{total} transaction(s)</span>
      </div>

      {/* List */}
      <TransactionsList
        isLoading={isLoading}
        transactions={transactions}
        accounts={accounts}
        logoMap={logoMap}
        onEdit={setEditTx}
        onDuplicate={setDuplicateTx}
        onDelete={setDeleteTx}
      />

      {(totalPages > 1 || total > 10) && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onChange={setPage}
          onLimitChange={handleLimitChange}
        />
      )}

      {addOpen && (
        <TxModal
          mode="create"
          accounts={accounts}
          logoMap={logoMap}
          categories={categories}
          paymentMethods={paymentMethods}
          onClose={() => setAddOpen(false)}
        />
      )}
      {duplicateTx && (
        <TxModal
          mode="create"
          accounts={accounts}
          logoMap={logoMap}
          categories={categories}
          paymentMethods={paymentMethods}
          duplicateFrom={duplicateTx}
          onClose={() => setDuplicateTx(null)}
        />
      )}
      {editTx && (
        <TxModal
          mode="edit"
          tx={editTx}
          accounts={accounts}
          logoMap={logoMap}
          categories={categories}
          paymentMethods={paymentMethods}
          onSave={handleUpdate}
          onClose={() => setEditTx(null)}
          isPending={updateTx.isPending}
        />
      )}
      {deleteTx && (
        <DeleteTxModal tx={deleteTx} onConfirm={handleDelete} onCancel={() => setDeleteTx(null)} />
      )}
    </div>
  );
}
