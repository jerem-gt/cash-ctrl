import { useState, type SubmitEvent } from 'react';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions, useCreateTransaction, useDeleteTransaction, useUpdateTransaction } from '@/hooks/useTransactions';
import { useBanks } from '@/hooks/useBanks';
import { Card, CardTitle, Button, Input, Select, FormGroup, Empty, ConfirmModal, showToast } from '@/components/ui';
import { AccountBadge } from '@/components/AccountBadge';
import { fmtDec, fmtDate, today } from '@/lib/format';
import { useCategories } from '@/hooks/useCategories';
import type { Account, Bank, Transaction, TransactionFilters } from '@/types';

type TxFormState = {
  type: 'income' | 'expense';
  amount: string;
  description: string;
  category: string;
  account_id: string;
  date: string;
};

function TxItem({ tx, accounts, banks, onEdit, onDelete }: {
  tx: Transaction;
  accounts: Account[];
  banks: Bank[];
  onEdit: (tx: Transaction) => void;
  onDelete: (id: number) => void;
}) {
  const account = accounts.find(a => a.id === tx.account_id);
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border border-black/[0.07] rounded-xl hover:border-black/13 transition-colors">
      <div className={`w-2 h-2 rounded-full shrink-0 ${tx.type === 'income' ? 'bg-green-500' : 'bg-red-400'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{tx.description}</p>
        <p className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-1 flex-wrap">
          <span>{tx.category} ·</span>
          <AccountBadge name={tx.account_name} bank={account?.bank} banks={banks} />
          <span>· {fmtDate(tx.date)}</span>
        </p>
      </div>
      <span className={`text-sm font-medium tabular-nums ${tx.type === 'income' ? 'text-green-800' : 'text-red-700'}`}>
        {tx.type === 'income' ? '+' : '−'}{fmtDec(tx.amount)}
      </span>
      <button
        onClick={() => onEdit(tx)}
        className="text-stone-300 hover:text-stone-600 transition-colors text-sm leading-none px-1"
        title="Modifier"
      >✎</button>
      <button
        onClick={() => onDelete(tx.id)}
        className="text-stone-300 hover:text-red-400 transition-colors text-lg leading-none px-1"
      >×</button>
    </div>
  );
}

function EditTxModal({
  tx,
  accounts,
  categories,
  onSave,
  onCancel,
  isPending,
}: {
  tx: Transaction;
  accounts: { id: number; name: string; bank?: string }[];
  categories: { id: number; name: string }[];
  onSave: (data: TxFormState) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<TxFormState>({
    type: tx.type,
    amount: String(tx.amount),
    description: tx.description,
    category: tx.category,
    account_id: String(tx.account_id),
    date: tx.date,
  });

  const isTransfer = tx.transfer_peer_id !== null;

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (!form.amount || !form.description || (!isTransfer && !form.account_id)) {
      showToast('Veuillez remplir tous les champs.');
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-lg shadow-xl">
        <h3 className="font-serif text-xl mb-1">Modifier la transaction</h3>
        {isTransfer && <p className="text-[11px] text-stone-400 mb-4">Transfert — montant, date et description appliqués aux deux legs.</p>}
        {!isTransfer && <div className="mb-5" />}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-3 flex-wrap">
            {!isTransfer && (
              <FormGroup label="Type">
                <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'income' | 'expense' }))}>
                  <option value="expense">Dépense</option>
                  <option value="income">Revenu</option>
                </Select>
              </FormGroup>
            )}
            <FormGroup label="Montant (€)">
              <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" min="0" step="0.01" />
            </FormGroup>
            <FormGroup label="Description">
              <Input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex : Courses Leclerc" />
            </FormGroup>
          </div>
          <div className="flex gap-3 flex-wrap items-end">
            {!isTransfer && (
              <>
                <FormGroup label="Catégorie">
                  <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </Select>
                </FormGroup>
                <FormGroup label="Compte">
                  <Select value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ''}</option>)}
                  </Select>
                </FormGroup>
              </>
            )}
            <FormGroup label="Date">
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </FormGroup>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" onClick={onCancel}>Annuler</Button>
            <Button type="submit" variant="primary" disabled={isPending}>{isPending ? '…' : 'Enregistrer'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TransactionsPage() {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: banks = [] } = useBanks();
  const [filters, setFilters] = useState<TransactionFilters>({});
  const { data: transactions = [], isLoading } = useTransactions(filters);
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();

  const [form, setForm] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    description: '',
    category: '',
    account_id: '',
    date: today(),
  });
  const [editTx, setEditTx] = useState<Transaction | null>(null);
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

  const handleUpdate = (data: TxFormState) => {
    if (!editTx) return;
    const payload = editTx.transfer_peer_id
      ? { id: editTx.id, amount: parseFloat(data.amount), description: data.description, date: data.date,
          type: editTx.type, account_id: editTx.account_id, category: editTx.category }
      : { id: editTx.id, type: data.type, amount: parseFloat(data.amount), description: data.description,
          category: data.category || categories[0]?.name || 'Autre', account_id: parseInt(data.account_id), date: data.date };
    updateTx.mutate(payload, {
      onSuccess: () => { setEditTx(null); showToast('Transaction modifiée ✓'); },
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
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ''}</option>)}
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
      {isLoading
        ? <p className="text-sm text-stone-400">Chargement…</p>
        : transactions.length === 0
          ? <Empty>Aucune transaction trouvée</Empty>
          : <div className="flex flex-col gap-2">{transactions.map(t => <TxItem key={t.id} tx={t} accounts={accounts} banks={banks} onEdit={setEditTx} onDelete={confirmDelete} />)}</div>
      }

      {editTx && (
        <EditTxModal
          tx={editTx}
          accounts={accounts}
          categories={categories}
          onSave={handleUpdate}
          onCancel={() => setEditTx(null)}
          isPending={updateTx.isPending}
        />
      )}

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
