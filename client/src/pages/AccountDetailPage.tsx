import { useState, type SubmitEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAccounts, useDeleteAccount, useUpdateAccount } from '@/hooks/useAccounts';
import { useTransactions, useCreateTransaction, useDeleteTransaction, useCreateTransfer } from '@/hooks/useTransactions';
import { Card, CardTitle, Button, Input, Select, FormGroup, Empty, ConfirmModal, showToast } from '@/components/ui';
import { fmtDec, fmtDate, today } from '@/lib/format';
import { useCategories } from '@/hooks/useCategories';
import { useAccountTypes } from '@/hooks/useAccountTypes';
import { useBanks } from '@/hooks/useBanks';

import type { Transaction } from '@/types';

function TxItem({ tx, onDelete }: { tx: Transaction; onDelete: (id: number) => void }) {
  const isTransfer = tx.transfer_peer_id !== null;
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border border-black/[0.07] rounded-xl hover:border-black/[0.13] transition-colors">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tx.type === 'income' ? 'bg-green-500' : 'bg-red-400'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{tx.description}</p>
          {isTransfer && (
            <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5 font-medium flex-shrink-0">
              ↔ Transfert
            </span>
          )}
        </div>
        <p className="text-[11px] text-stone-400 mt-0.5">{tx.category} · {fmtDate(tx.date)}</p>
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

type FormMode = 'transaction' | 'transfer';

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const accountId = parseInt(id ?? '0');
  const navigate = useNavigate();

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: accountTypes = [] } = useAccountTypes();
  const { data: banks = [] } = useBanks();
  const deleteAccount = useDeleteAccount();
  const updateAccount = useUpdateAccount();
  const { data: transactions = [], isLoading } = useTransactions({ account_id: accountId });
  const createTx = useCreateTransaction();
  const deleteTx = useDeleteTransaction();
  const createTransfer = useCreateTransfer();

  const account = accounts.find(a => a.id === accountId);
  const otherAccounts = accounts.filter(a => a.id !== accountId);

  const balance = transactions.reduce(
    (sum, t) => t.type === 'income' ? sum + t.amount : sum - t.amount,
    account?.initial_balance ?? 0
  );

  const [mode, setMode] = useState<FormMode>('transaction');

  const [txForm, setTxForm] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    description: '',
    category: '',
    date: today(),
  });

  const [transferForm, setTransferForm] = useState({
    to_account_id: '',
    amount: '',
    description: 'Transfert',
    date: today(),
  });

  const [deleteTxId, setDeleteTxId] = useState<number | null>(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', bank: '', type: '', initial_balance: '' });

  const handleTxSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (!txForm.amount || !txForm.description) {
      showToast('Veuillez remplir tous les champs.');
      return;
    }
    createTx.mutate({
      type: txForm.type,
      amount: parseFloat(txForm.amount),
      description: txForm.description,
      category: txForm.category || categories[0]?.name || 'Autre',
      account_id: accountId,
      date: txForm.date,
    }, {
      onSuccess: () => {
        setTxForm(f => ({ ...f, amount: '', description: '' }));
        showToast('Transaction ajoutée ✓');
      },
      onError: e => showToast(e.message),
    });
  };

  const handleTransferSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (!transferForm.amount || !transferForm.to_account_id) {
      showToast('Veuillez remplir tous les champs.');
      return;
    }
    createTransfer.mutate({
      from_account_id: accountId,
      to_account_id: parseInt(transferForm.to_account_id),
      amount: parseFloat(transferForm.amount),
      description: transferForm.description || 'Transfert',
      date: transferForm.date,
    }, {
      onSuccess: () => {
        setTransferForm(f => ({ ...f, amount: '', description: 'Transfert' }));
        showToast('Transfert effectué ✓');
      },
      onError: e => showToast(e.message),
    });
  };

  const handleDeleteTx = () => {
    if (!deleteTxId) return;
    const tx = transactions.find(t => t.id === deleteTxId);
    deleteTx.mutate(deleteTxId, {
      onSuccess: () => {
        setDeleteTxId(null);
        showToast(tx?.transfer_peer_id ? 'Transfert supprimé' : 'Transaction supprimée');
      },
    });
  };

  const handleDeleteAccount = () => {
    deleteAccount.mutate(accountId, {
      onSuccess: () => { navigate('/accounts'); showToast('Compte supprimé'); },
    });
  };

  const openEdit = () => {
    if (!account) return;
    setEditForm({ name: account.name, bank: account.bank ?? '', type: account.type, initial_balance: String(account.initial_balance) });
    setEditOpen(true);
  };

  const handleEditSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) { showToast('Le nom est requis.'); return; }
    updateAccount.mutate({
      id: accountId,
      name: editForm.name.trim(),
      bank: editForm.bank.trim(),
      type: editForm.type,
      initial_balance: parseFloat(editForm.initial_balance) || 0,
    }, {
      onSuccess: () => { setEditOpen(false); showToast('Compte mis à jour ✓'); },
      onError: err => showToast(err.message),
    });
  };

  if (!account && accounts.length > 0) {
    return (
      <div className="space-y-5">
        <button onClick={() => navigate('/accounts')} className="text-sm text-stone-400 hover:text-stone-600 transition-colors">← Comptes</button>
        <p className="text-sm text-stone-400">Compte introuvable.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <button onClick={() => navigate('/accounts')} className="text-xs text-stone-400 hover:text-stone-600 transition-colors mb-3 block">← Comptes</button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              {account?.bank && (() => { const logo = banks.find(b => b.name === account.bank)?.logo; return logo ? <img src={logo} alt="" className="w-6 h-6 object-contain rounded shrink-0" onError={e => (e.currentTarget.style.display = 'none')} /> : null; })()}
              <h2 className="font-serif text-2xl tracking-tight">{account?.name ?? '…'}</h2>
              {account?.bank && <span className="text-stone-400 text-base">({account.bank})</span>}
            </div>
            <p className="text-sm text-stone-400 mt-0.5">{account?.type ?? ''}</p>
          </div>
          <div className="text-right">
            <p className={`font-serif text-3xl ${balance < 0 ? 'text-red-700' : 'text-stone-900'}`}>{fmtDec(balance)}</p>
            <div className="flex gap-3 justify-end mt-1">
              <button onClick={openEdit} className="text-[11px] text-stone-400 hover:text-stone-700 transition-colors">
                Modifier
              </button>
              <button onClick={() => setConfirmDeleteAccount(true)} className="text-[11px] text-stone-300 hover:text-red-400 transition-colors">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit account */}
      {editOpen && (
        <Card>
          <CardTitle>Modifier le compte</CardTitle>
          <form onSubmit={handleEditSubmit}>
            <div className="flex gap-3 flex-wrap items-end">
              <FormGroup label="Nom du compte">
                <Input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom" className="min-w-44" />
              </FormGroup>
              <FormGroup label="Banque">
                <Select value={editForm.bank} onChange={e => setEditForm(f => ({ ...f, bank: e.target.value }))}>
                  <option value="">— Aucune —</option>
                  {banks.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </Select>
              </FormGroup>
              <FormGroup label="Type">
                <Select value={editForm.type || accountTypes[0]?.name} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>
                  {accountTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </Select>
              </FormGroup>
              <FormGroup label="Solde initial (€)">
                <Input type="number" value={editForm.initial_balance} onChange={e => setEditForm(f => ({ ...f, initial_balance: e.target.value }))} placeholder="0,00" step="0.01" />
              </FormGroup>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" disabled={updateAccount.isPending}>
                  {updateAccount.isPending ? '…' : 'Enregistrer'}
                </Button>
                <Button type="button" onClick={() => setEditOpen(false)}>Annuler</Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {/* Form card */}
      <Card>
        {/* Mode toggle */}
        <div className="flex gap-1 mb-4 bg-stone-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setMode('transaction')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${mode === 'transaction' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400 hover:text-stone-600'}`}
          >
            Transaction
          </button>
          <button
            onClick={() => setMode('transfer')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${mode === 'transfer' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400 hover:text-stone-600'}`}
          >
            ↔ Transfert
          </button>
        </div>

        {mode === 'transaction' ? (
          <>
            <CardTitle>Nouvelle transaction</CardTitle>
            <form onSubmit={handleTxSubmit} className="space-y-3">
              <div className="flex gap-3 flex-wrap">
                <FormGroup label="Type">
                  <Select value={txForm.type} onChange={e => setTxForm(f => ({ ...f, type: e.target.value as 'income' | 'expense' }))}>
                    <option value="expense">Dépense</option>
                    <option value="income">Revenu</option>
                  </Select>
                </FormGroup>
                <FormGroup label="Montant (€)">
                  <Input type="number" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" min="0" step="0.01" />
                </FormGroup>
                <FormGroup label="Description">
                  <Input type="text" value={txForm.description} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex : Courses Leclerc" className="min-w-[180px]" />
                </FormGroup>
              </div>
              <div className="flex gap-3 flex-wrap items-end">
                <FormGroup label="Catégorie">
                  <Select value={txForm.category} onChange={e => setTxForm(f => ({ ...f, category: e.target.value }))}>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </Select>
                </FormGroup>
                <FormGroup label="Date">
                  <Input type="date" value={txForm.date} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))} />
                </FormGroup>
                <Button type="submit" variant="primary" disabled={createTx.isPending}>
                  {createTx.isPending ? '…' : 'Ajouter'}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <CardTitle>Transfert vers un autre compte</CardTitle>
            {otherAccounts.length === 0 ? (
              <p className="text-sm text-stone-400">Vous n'avez pas d'autre compte.</p>
            ) : (
              <form onSubmit={handleTransferSubmit} className="space-y-3">
                <div className="flex gap-3 flex-wrap items-end">
                  <FormGroup label="Vers">
                    <Select value={transferForm.to_account_id} onChange={e => setTransferForm(f => ({ ...f, to_account_id: e.target.value }))}>
                      <option value="">— Choisir —</option>
                      {otherAccounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ''}</option>)}
                    </Select>
                  </FormGroup>
                  <FormGroup label="Montant (€)">
                    <Input type="number" value={transferForm.amount} onChange={e => setTransferForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" min="0" step="0.01" />
                  </FormGroup>
                  <FormGroup label="Description">
                    <Input type="text" value={transferForm.description} onChange={e => setTransferForm(f => ({ ...f, description: e.target.value }))} placeholder="Transfert" className="min-w-[140px]" />
                  </FormGroup>
                  <FormGroup label="Date">
                    <Input type="date" value={transferForm.date} onChange={e => setTransferForm(f => ({ ...f, date: e.target.value }))} />
                  </FormGroup>
                  <Button type="submit" variant="primary" disabled={createTransfer.isPending}>
                    {createTransfer.isPending ? '…' : 'Transférer'}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </Card>

      {/* Transaction list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Transactions</p>
          <span className="text-xs text-stone-400">{transactions.length} transaction(s)</span>
        </div>
        {isLoading
          ? <p className="text-sm text-stone-400">Chargement…</p>
          : transactions.length === 0
            ? <Empty>Aucune transaction sur ce compte</Empty>
            : <div className="flex flex-col gap-2">{transactions.map(t => <TxItem key={t.id} tx={t} onDelete={setDeleteTxId} />)}</div>
        }
      </div>

      {deleteTxId && (
        <ConfirmModal
          title={transactions.find(t => t.id === deleteTxId)?.transfer_peer_id ? 'Supprimer le transfert' : 'Supprimer la transaction'}
          body={transactions.find(t => t.id === deleteTxId)?.transfer_peer_id
            ? 'Les deux côtés du transfert seront supprimés. Cette action est irréversible.'
            : 'Cette action est irréversible. Confirmer la suppression ?'}
          onConfirm={handleDeleteTx}
          onCancel={() => setDeleteTxId(null)}
        />
      )}
      {confirmDeleteAccount && (
        <ConfirmModal
          title="Supprimer le compte"
          body="Toutes les transactions associées seront supprimées. Cette action est irréversible."
          onConfirm={handleDeleteAccount}
          onCancel={() => setConfirmDeleteAccount(false)}
        />
      )}
    </div>
  );
}
