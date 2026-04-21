import { useState, type SubmitEvent } from 'react';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions, useCreateTransaction, useDeleteTransaction, useUpdateTransaction } from '@/hooks/useTransactions';
import { useBanks } from '@/hooks/useBanks';
import { Card, CardTitle, Button, Input, Select, FormGroup, showToast } from '@/components/ui';
import { DeleteTxModal } from '@/components/DeleteTxModal';
import { AccountSelect } from '@/components/AccountSelect';
import { EditTxModal, type TxFormState } from '@/components/EditTxModal';
import { TransactionsList } from '@/components/TransactionsList';
import { today } from '@/lib/format';
import { useCategories } from '@/hooks/useCategories';
import type { Transaction, TransactionFilters } from '@/types';

export function TransactionsPage() {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: banks = [] } = useBanks();
  const [filters, setFilters] = useState<TransactionFilters>({});
  const { data: transactions = [], isLoading } = useTransactions(filters);
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const deleteTxMutation = useDeleteTransaction();

  const [form, setForm] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    description: '',
    category: '',
    account_id: '',
    date: today(),
  });
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null);

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (!form.amount || !form.description || !form.account_id) {
      showToast('Veuillez remplir tous les champs.');
      return;
    }
    createTx.mutate({
      type: form.type,
      amount: Number.parseFloat(form.amount),
      description: form.description,
      category: form.category || categories[0]?.name || 'Autre',
      account_id: Number.parseInt(form.account_id),
      date: form.date,
    }, {
      onSuccess: () => {
        setForm(f => ({ ...f, amount: '', description: '' }));
        showToast('Transaction ajoutée ✓');
      },
      onError: (e) => showToast(e.message),
    });
  };

  const handleUpdate = (data: TxFormState) => {
    if (!editTx) return;
    const payload = editTx.transfer_peer_id
      ? { id: editTx.id, amount: Number.parseFloat(data.amount), description: data.description, date: data.date,
          type: editTx.type, account_id: editTx.account_id, category: editTx.category }
      : { id: editTx.id, type: data.type, amount: Number.parseFloat(data.amount), description: data.description,
          category: data.category || categories[0]?.name || 'Autre', account_id: Number.parseInt(data.account_id), date: data.date };
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

      {/* Add form */}
      <Card>
        <CardTitle>Nouvelle transaction</CardTitle>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-3 flex-wrap">
            <FormGroup label="Type">
              <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'income' | 'expense' }))}>
                <option value="expense">Dépense</option>
                <option value="income">Revenu</option>
              </Select>
            </FormGroup>
            <FormGroup label="Montant (€)">
              <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" min="0" step="0.01" />
            </FormGroup>
            <FormGroup label="Description" >
              <Input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex : Courses Leclerc" className="min-w-45" />
            </FormGroup>
          </div>
          <div className="flex gap-3 flex-wrap items-end">
            <FormGroup label="Catégorie">
              <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </Select>
            </FormGroup>
            <FormGroup label="Compte">
              <AccountSelect value={form.account_id} onChange={v => setForm(f => ({ ...f, account_id: v }))} accounts={accounts} banks={banks} />
            </FormGroup>
            <FormGroup label="Date">
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </FormGroup>
            <Button type="submit" variant="primary" disabled={createTx.isPending}>
              {createTx.isPending ? '…' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <Select className="flex-1 min-w-32.5 max-w-50" value={filters.account_id ?? ''} onChange={e => setFilters(f => ({ ...f, account_id: e.target.value ? Number.parseInt(e.target.value) : undefined }))}>
          <option value="">Tous les comptes</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ''}</option>)}
        </Select>
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
          banks={banks}
          onEdit={setEditTx}
          onDelete={setDeleteTx}
      />

      {editTx && (
        <EditTxModal
          tx={editTx}
          accounts={accounts}
          banks={banks}
          categories={categories}
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
