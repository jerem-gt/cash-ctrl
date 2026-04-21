import { useState, type SubmitEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAccounts, useDeleteAccount, useUpdateAccount } from '@/hooks/useAccounts';
import { useTransactions, useCreateTransaction, useDeleteTransaction, useCreateTransfer, useUpdateTransaction } from '@/hooks/useTransactions';
import { Card, CardTitle, Button, Input, Select, FormGroup, ConfirmModal, showToast } from '@/components/ui';
import { fmtDec, today } from '@/lib/format';
import { useCategories } from '@/hooks/useCategories';
import { useAccountTypes } from '@/hooks/useAccountTypes';
import { useBanks } from '@/hooks/useBanks';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { BankSelect } from '@/components/BankSelect';
import { TransactionsList } from '@/components/TransactionsList';
import { EditTxModal, type TxFormState } from '@/components/EditTxModal';
import { DeleteTxModal } from '@/components/DeleteTxModal';


type FormMode = 'transaction' | 'transfer';

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const accountId = Number.parseInt(id ?? '0');
  const navigate = useNavigate();

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: accountTypes = [] } = useAccountTypes();
  const { data: banks = [] } = useBanks();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const deleteAccount = useDeleteAccount();
  const updateAccount = useUpdateAccount();
  const { data: transactions = [], isLoading } = useTransactions({ account_id: accountId });
  const createTx = useCreateTransaction();
  const deleteTxMutation = useDeleteTransaction();
  const updateTx = useUpdateTransaction();
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
    payment_method: '',
  });

  const [transferForm, setTransferForm] = useState({
    to_account_id: '',
    amount: '',
    description: 'Transfert',
    date: today(),
  });

  const [editTx, setEditTx] = useState<(typeof transactions)[0] | null>(null);
  const [deleteTx, setDeleteTx] = useState<(typeof transactions)[0] | null>(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', bank: '', type: '', initial_balance: '' });

  const handleTxSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (!txForm.amount || !txForm.description || !txForm.payment_method) {
      showToast('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    createTx.mutate({
      type: txForm.type,
      amount: Number.parseFloat(txForm.amount),
      description: txForm.description,
      category: txForm.category || categories[0]?.name || 'Autre',
      account_id: accountId,
      date: txForm.date,
      payment_method: txForm.payment_method,
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
      to_account_id: Number.parseInt(transferForm.to_account_id),
      amount: Number.parseFloat(transferForm.amount),
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
    if (!deleteTx) return;
    deleteTxMutation.mutate(deleteTx.id, {
      onSuccess: () => {
        setDeleteTx(null);
        showToast(deleteTx.transfer_peer_id ? 'Transfert supprimé' : 'Transaction supprimée');
      },
    });
  };

  const handleUpdateTx = (data: TxFormState) => {
    if (!editTx) return;
    const payload = editTx.transfer_peer_id
      ? { id: editTx.id, amount: Number.parseFloat(data.amount), description: data.description, date: data.date,
          type: editTx.type, account_id: editTx.account_id, category: editTx.category,
          payment_method: editTx.payment_method, notes: editTx.notes, validated: !!editTx.validated }
      : { id: editTx.id, type: data.type, amount: Number.parseFloat(data.amount), description: data.description,
          category: data.category, account_id: Number.parseInt(data.account_id), date: data.date,
          payment_method: data.payment_method, notes: data.notes || null, validated: data.validated };
    updateTx.mutate(payload, {
      onSuccess: () => { setEditTx(null); showToast('Transaction modifiée ✓'); },
      onError: (e) => showToast(e.message),
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
    if (!editForm.bank) { showToast('La banque est requise.'); return; }
    updateAccount.mutate({
      id: accountId,
      name: editForm.name.trim(),
      bank: editForm.bank.trim(),
      type: editForm.type,
      initial_balance: Number.parseFloat(editForm.initial_balance) || 0,
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
                <BankSelect value={editForm.bank} onChange={v => setEditForm(f => ({ ...f, bank: v }))} banks={banks} />
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
                <FormGroup label="Moyen de paiement">
                  <Select value={txForm.payment_method} onChange={e => setTxForm(f => ({ ...f, payment_method: e.target.value }))}>
                    <option value="">— Choisir —</option>
                    {paymentMethods.map(m => <option key={m.id} value={m.name}>{m.icon} {m.name}</option>)}
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
        <TransactionsList
          isLoading={isLoading}
          transactions={transactions}
          accounts={accounts}
          banks={banks}
          onEdit={setEditTx}
          onDelete={setDeleteTx}
          emptyMessage="Aucune transaction sur ce compte"
        />
      </div>

      {deleteTx && (
        <DeleteTxModal tx={deleteTx} onConfirm={handleDeleteTx} onCancel={() => setDeleteTx(null)} />
      )}
      {editTx && (
        <EditTxModal
          tx={editTx}
          accounts={accounts}
          banks={banks}
          categories={categories}
          paymentMethods={paymentMethods}
          onSave={handleUpdateTx}
          onCancel={() => setEditTx(null)}
          isPending={updateTx.isPending}
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
