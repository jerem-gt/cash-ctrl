import { useState, useMemo } from 'react';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions, useDeleteTransaction, useUpdateTransaction } from '@/hooks/useTransactions';
import { useBanks } from '@/hooks/useBanks';
import { Select, showToast } from '@/components/ui';
import { DeleteTxModal } from '@/components/DeleteTxModal';
import { AccountSelect } from '@/components/AccountSelect';
import { EditTxModal, type TxFormState } from '@/components/EditTxModal';
import { TransactionsList } from '@/components/TransactionsList';
import { AddTxForm } from '@/components/AddTxForm';
import { useCategories } from '@/hooks/useCategories';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import type { Transaction, TransactionFilters } from '@/types';

export function TransactionsPage() {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: banks = [] } = useBanks();
  const logoMap = useMemo(() => Object.fromEntries(banks.map(b => [b.name, b.logo])), [banks]);
  const { data: paymentMethods = [] } = usePaymentMethods();
  const [filters, setFilters] = useState<TransactionFilters>({});
  const { data: transactions = [], isLoading } = useTransactions(filters);
  const updateTx = useUpdateTransaction();
  const deleteTxMutation = useDeleteTransaction();

  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null);

  const handleUpdate = (data: TxFormState) => {
    if (!editTx) return;
    const payload = editTx.transfer_peer_id
      ? { id: editTx.id, amount: Number.parseFloat(data.amount), description: data.description, date: data.date,
          type: editTx.type, account_id: editTx.account_id, category: editTx.category,
          payment_method: editTx.payment_method, notes: editTx.notes, validated: !!editTx.validated }
      : { id: editTx.id, type: data.type, amount: Number.parseFloat(data.amount), description: data.description,
          category: data.category || categories[0]?.name || 'Autre', account_id: Number.parseInt(data.account_id), date: data.date,
          payment_method: data.payment_method, notes: data.notes || null, validated: data.validated };
    updateTx.mutate(payload, {
      onSuccess: () => { setEditTx(null); showToast('Transaction modifiée ✓'); },
      onError: (e) => showToast(e.message),
    });
  };

  const handleDelete = () => {
    if (!deleteTx) return;
    deleteTxMutation.mutate(deleteTx.id, {
      onSuccess: () => { setDeleteTx(null); showToast(deleteTx.transfer_peer_id ? 'Transfert supprimé' : 'Transaction supprimée'); },
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl tracking-tight">Transactions</h2>
        <p className="text-sm text-stone-400 mt-0.5">Gérez vos revenus et dépenses</p>
      </div>

      <AddTxForm
        accounts={accounts}
        logoMap={logoMap}
        categories={categories}
        paymentMethods={paymentMethods}
      />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-32.5 max-w-50">
          <AccountSelect
            value={String(filters.account_id ?? '')}
            onChange={v => setFilters(f => ({ ...f, account_id: v ? Number.parseInt(v) : undefined }))}
            accounts={accounts}
            logoMap={logoMap}
            placeholder="Tous les comptes"
          />
        </div>
        <Select className="flex-1 min-w-32.5 max-w-50" value={filters.category ?? ''} onChange={e => setFilters(f => ({ ...f, category: e.target.value || undefined }))}>
          <option value="">Toutes catégories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </Select>
        <Select className="flex-1 min-w-32.5 max-w-50" value={filters.type ?? ''} onChange={e => setFilters(f => ({ ...f, type: (e.target.value || undefined) as 'income' | 'expense' | undefined }))}>
          <option value="">Tous types</option>
          <option value="income">Revenus</option>
          <option value="expense">Dépenses</option>
        </Select>
        <span className="text-xs text-stone-400 ml-auto">{transactions.length} transaction(s)</span>
      </div>

      {/* List */}
      <TransactionsList
          isLoading={isLoading}
          transactions={transactions}
          accounts={accounts}
          logoMap={logoMap}
          onEdit={setEditTx}
          onDelete={setDeleteTx}
      />

      {editTx && (
        <EditTxModal
          tx={editTx}
          accounts={accounts}
          logoMap={logoMap}
          categories={categories}
          paymentMethods={paymentMethods}
          onSave={handleUpdate}
          onCancel={() => setEditTx(null)}
          isPending={updateTx.isPending}
        />
      )}
      {deleteTx && (
        <DeleteTxModal tx={deleteTx} onConfirm={handleDelete} onCancel={() => setDeleteTx(null)} />
      )}
    </div>
  );
}
