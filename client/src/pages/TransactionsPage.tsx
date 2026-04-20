import { useState, type SubmitEvent } from 'react';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions, useCreateTransaction, useDeleteTransaction } from '@/hooks/useTransactions';
import { Card, CardTitle, Button, Input, Select, FormGroup, Empty, ConfirmModal, showToast } from '@/components/ui';
import { fmtDec, fmtDate, today } from '@/lib/format';
import { useCategories } from '@/hooks/useCategories';
import type { Transaction, TransactionFilters } from '@/types';

function TxItem({ tx, onDelete }: { tx: Transaction; onDelete: (id: number) => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border border-black/[0.07] rounded-xl hover:border-black/13 transition-colors">
      <div className={`w-2 h-2 rounded-full shrink-0 ${tx.type === 'income' ? 'bg-green-500' : 'bg-red-400'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{tx.description}</p>
        <p className="text-[11px] text-stone-400 mt-0.5">{tx.category} · {tx.account_name} · {fmtDate(tx.date)}</p>
      </div>
      <span className={`text-sm font-medium tabular-nums ${tx.type === 'income' ? 'text-green-800' : 'text-red-700'}`}>
        {tx.type === 'income' ? '+' : '−'}{fmtDec(tx.amount)}
      </span>
      <button
        onClick={() => onDelete(tx.id)}
        className="text-stone-300 hover:text-red-400 transition-colors text-lg leading-none px-1"
      >×</button>
    </div>
  );
}

export function TransactionsPage() {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const [filters, setFilters] = useState<TransactionFilters>({});
  const { data: transactions = [], isLoading } = useTransactions(filters);
  const createTx = useCreateTransaction();
  const deleteTx = useDeleteTransaction();

  const [form, setForm] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    description: '',
    category: '',
    account_id: '',
    date: today(),
  });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (!form.amount || !form.description || !form.account_id) {
      showToast('Veuillez remplir tous les champs.');
      return;
    }
    createTx.mutate({
      type: form.type,
      amount: parseFloat(form.amount),
      description: form.description,
      category: form.category || categories[0]?.name || 'Autre',
      account_id: parseInt(form.account_id),
      date: form.date,
    }, {
      onSuccess: () => {
        setForm(f => ({ ...f, amount: '', description: '' }));
        showToast('Transaction ajoutée ✓');
      },
      onError: (e) => showToast(e.message),
    });
  };

  const confirmDelete = (id: number) => setDeleteId(id);
  const handleDelete = () => {
    if (!deleteId) return;
    deleteTx.mutate(deleteId, {
      onSuccess: () => { setDeleteId(null); showToast('Transaction supprimée'); },
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
              <Select value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}>
                <option value="">— Choisir —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
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
        <Select className="flex-1 min-w-32.5 max-w-50" value={filters.account_id ?? ''} onChange={e => setFilters(f => ({ ...f, account_id: e.target.value ? parseInt(e.target.value) : undefined }))}>
          <option value="">Tous les comptes</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
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
      {isLoading
        ? <p className="text-sm text-stone-400">Chargement…</p>
        : transactions.length === 0
          ? <Empty>Aucune transaction trouvée</Empty>
          : <div className="flex flex-col gap-2">{transactions.map(t => <TxItem key={t.id} tx={t} onDelete={confirmDelete} />)}</div>
      }

      {deleteId && (
        <ConfirmModal
          title="Supprimer la transaction"
          body="Cette action est irréversible. Confirmer la suppression ?"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
