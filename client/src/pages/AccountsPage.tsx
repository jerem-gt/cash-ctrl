import { useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccounts, useCreateAccount } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useAccountTypes } from '@/hooks/useAccountTypes';
import { useBanks } from '@/hooks/useBanks';
import { Card, CardTitle, Button, Input, Select, FormGroup, Empty, showToast } from '@/components/ui';
import { AccountBadge } from '@/components/AccountBadge';
import { fmtDec } from '@/lib/format';
import { computeBalance } from '@/lib/account';

export function AccountsPage() {
  const navigate = useNavigate();
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useTransactions();
  const { data: accountTypes = [] } = useAccountTypes();
  const { data: banks = [] } = useBanks();
  const createAccount = useCreateAccount();

  const [form, setForm] = useState({ name: '', bank: '', type: '', initial_balance: '' });

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Donnez un nom au compte.'); return; }
    createAccount.mutate({
      name: form.name.trim(),
      bank: form.bank.trim(),
      type: form.type,
      initial_balance: parseFloat(form.initial_balance) || 0,
    }, {
      onSuccess: () => {
        setForm({ name: '', bank: '', type: accountTypes[0]?.name ?? '', initial_balance: '' });
        showToast('Compte créé ✓');
      },
      onError: e => showToast(e.message),
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl tracking-tight">Comptes</h2>
        <p className="text-sm text-stone-400 mt-0.5">Cliquez sur un compte pour voir ses transactions</p>
      </div>

      {/* Accounts grid */}
      {accounts.length === 0
        ? <Empty>Aucun compte. Créez-en un ci-dessous.</Empty>
        : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map(acc => {
              const bal = computeBalance(acc, transactions);
              return (
                <button
                  key={acc.id}
                  onClick={() => navigate(`/accounts/${acc.id}`)}
                  className="bg-white border border-black/[0.07] rounded-2xl p-5 shadow-sm text-left hover:border-black/18 hover:shadow-md transition-all duration-150 group"
                >
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <AccountBadge name={acc.name} bank={acc.bank} banks={banks} className="text-sm font-medium" />
                    <span className="text-stone-300 group-hover:text-stone-500 transition-colors text-sm shrink-0">→</span>
                  </div>
                  <p className={`font-serif text-3xl ${bal < 0 ? 'text-red-700' : 'text-stone-900'}`}>{fmtDec(bal)}</p>
                  <p className="text-[11px] text-stone-300 mt-2 uppercase tracking-wider">{acc.type}</p>
                </button>
              );
            })}
          </div>
        )
      }

      {/* Create form */}
      <Card>
        <CardTitle>Ajouter un compte</CardTitle>
        <form onSubmit={handleSubmit}>
          <div className="flex gap-3 flex-wrap items-end">
            <FormGroup label="Nom du compte">
              <Input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex : Compte courant" className="min-w-44" />
            </FormGroup>
            <FormGroup label="Banque">
              <Select value={form.bank} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))}>
                <option value="">— Aucune —</option>
                {banks.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </Select>
            </FormGroup>
            <FormGroup label="Type">
              <Select value={form.type || accountTypes[0]?.name} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {accountTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </Select>
            </FormGroup>
            <FormGroup label="Solde initial (€)">
              <Input type="number" value={form.initial_balance} onChange={e => setForm(f => ({ ...f, initial_balance: e.target.value }))} placeholder="0,00" step="0.01" />
            </FormGroup>
            <Button type="submit" variant="primary" disabled={createAccount.isPending}>
              {createAccount.isPending ? '…' : 'Créer'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
