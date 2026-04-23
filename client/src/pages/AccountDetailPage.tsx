import { useState, useMemo, type SubmitEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAccounts, useDeleteAccount, useUpdateAccount } from '@/hooks/useAccounts';
import { useTransactions, useDeleteTransaction, useUpdateTransaction } from '@/hooks/useTransactions';
import { Card, CardTitle, Button, Input, Select, FormGroup, ConfirmModal, showToast } from '@/components/ui';
import { fmtDec } from '@/lib/format';
import { useCategories } from '@/hooks/useCategories';
import { useAccountTypes } from '@/hooks/useAccountTypes';
import { useBanks } from '@/hooks/useBanks';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { BankSelect } from '@/components/BankSelect';
import { TransactionsList } from '@/components/TransactionsList';
import { AddTxForm } from '@/components/AddTxForm';
import { EditTxModal, type TxFormState } from '@/components/EditTxModal';
import { DeleteTxModal } from '@/components/DeleteTxModal';


export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const accountId = Number.parseInt(id ?? '0');
  const navigate = useNavigate();

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: accountTypes = [] } = useAccountTypes();
  const { data: banks = [] } = useBanks();
  const logoMap = useMemo(() => Object.fromEntries(banks.map(b => [b.name, b.logo])), [banks]);
  const { data: paymentMethods = [] } = usePaymentMethods();
  const deleteAccount = useDeleteAccount();
  const updateAccount = useUpdateAccount();
  const { data: transactions = [], isLoading } = useTransactions({ account_id: accountId });
  const deleteTxMutation = useDeleteTransaction();
  const updateTx = useUpdateTransaction();

  const account = accounts.find(a => a.id === accountId);

  const balance = transactions.reduce(
    (sum, t) => t.type === 'income' ? sum + t.amount : sum - t.amount,
    account?.initial_balance ?? 0
  );

  const [editTx, setEditTx] = useState<(typeof transactions)[0] | null>(null);
  const [deleteTx, setDeleteTx] = useState<(typeof transactions)[0] | null>(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', bank_id: '', account_type_id: '', initial_balance: '' });

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
          type: editTx.type, account_id: editTx.account_id, category_id: editTx.category_id ?? 0,
          payment_method_id: editTx.payment_method_id ?? 0, notes: editTx.notes, validated: !!editTx.validated }
      : { id: editTx.id, type: data.type, amount: Number.parseFloat(data.amount), description: data.description,
          category_id: Number.parseInt(data.category_id), account_id: Number.parseInt(data.account_id), date: data.date,
          payment_method_id: Number.parseInt(data.payment_method_id), notes: data.notes || null, validated: data.validated };
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
    setEditForm({ name: account.name, bank_id: String(account.bank_id ?? ''), account_type_id: String(account.account_type_id ?? ''), initial_balance: String(account.initial_balance) });
    setEditOpen(true);
  };

  const handleEditSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) { showToast('Le nom est requis.'); return; }
    updateAccount.mutate({
      id: accountId,
      name: editForm.name.trim(),
      bank_id: Number.parseInt(editForm.bank_id) || null,
      account_type_id: Number.parseInt(editForm.account_type_id) || null,
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
              {account?.bank && logoMap[account.bank] && <img src={logoMap[account.bank]!} alt="" className="w-6 h-6 object-contain rounded shrink-0" onError={e => (e.currentTarget.style.display = 'none')} />}
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
                <BankSelect value={editForm.bank_id} onChange={v => setEditForm(f => ({ ...f, bank_id: v }))} banks={banks} />
              </FormGroup>
              <FormGroup label="Type">
                <Select value={editForm.account_type_id || String(accountTypes[0]?.id ?? '')} onChange={e => setEditForm(f => ({ ...f, account_type_id: e.target.value }))}>
                  {accountTypes.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
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

      <AddTxForm
        accounts={accounts}
        logoMap={logoMap}
        categories={categories}
        paymentMethods={paymentMethods}
        fixedAccountId={accountId}
      />

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
          logoMap={logoMap}
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
          logoMap={logoMap}
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
