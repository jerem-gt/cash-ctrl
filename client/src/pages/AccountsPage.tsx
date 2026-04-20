import { useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccounts, useCreateAccount } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { Card, CardTitle, Button, Input, Select, FormGroup, Empty, showToast } from '@/components/ui';
import { fmtDec } from '@/lib/format';
import { ACCOUNT_TYPE_LABELS } from '@/types';
import type { AccountType, Account, Transaction } from '@/types';

const ACCOUNT_TYPES: AccountType[] = ['Courant', 'Epargne', 'Livret', 'Credit', 'Autre'];

function computeBalance(account: Account, transactions: Transaction[]): number {
  return transactions
    .filter(t => t.account_id === account.id)
    .reduce((sum, t) => t.type === 'income' ? sum + t.amount : sum - t.amount, account.initial_balance);
}

export function AccountsPage() {
  const navigate = useNavigate();
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useTransactions();
  const createAccount = useCreateAccount();

  const [form, setForm] = useState({ name: '', bank: '', type: 'Courant' as AccountType, initial_balance: '' });

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
        setForm({ name: '', bank: '', type: 'Courant', initial_balance: '' });
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
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-sm font-medium truncate">{acc.name}</p>
                    <span className="text-stone-300 group-hover:text-stone-500 transition-colors text-sm">→</span>
                  </div>
                  <p className={`font-serif text-3xl ${bal < 0 ? 'text-red-700' : 'text-stone-900'}`}>{fmtDec(bal)}</p>
                  <p className="text-[11px] text-stone-300 mt-2 uppercase tracking-wider">{ACCOUNT_TYPE_LABELS[acc.type]}{acc.bank ? ` · ${acc.bank}` : ''}</p>
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
              <Input type="text" value={form.bank} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))} placeholder="Ex : BNP Paribas" className="min-w-36" />
            </FormGroup>
            <FormGroup label="Type">
              <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as AccountType }))}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>)}
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
