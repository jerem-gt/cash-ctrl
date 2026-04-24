import { type SubmitEvent, useState } from 'react';

import { AccountSelect } from '@/components/AccountSelect';
import { Button, FormGroup, Input, Select, showToast } from '@/components/ui';
import type { Account, PaymentMethod, Transaction } from '@/types';

export type TxFormState = {
  type: 'income' | 'expense';
  amount: string;
  description: string;
  category_id: string;
  account_id: string;
  date: string;
  payment_method_id: string;
  notes: string;
  validated: boolean;
};

interface Props {
  tx: Transaction;
  accounts: Account[];
  logoMap: Record<string, string | null>;
  categories: { id: number; name: string }[];
  paymentMethods: PaymentMethod[];
  onSave: (data: TxFormState) => void;
  onCancel: () => void;
  isPending: boolean;
}

export function EditTxModal({ tx, accounts, logoMap, categories, paymentMethods, onSave, onCancel, isPending }: Readonly<Props>) {
  const [form, setForm] = useState<TxFormState>({
    type: tx.type,
    amount: String(tx.amount),
    description: tx.description,
    category_id: String(tx.category_id ?? ''),
    account_id: String(tx.account_id),
    date: tx.date,
    payment_method_id: String(tx.payment_method_id ?? ''),
    notes: tx.notes ?? '',
    validated: !!tx.validated,
  });

  const isTransfer = tx.transfer_peer_id !== null;

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (!form.amount || !form.description || (!isTransfer && !form.account_id) || (!isTransfer && !form.payment_method_id)) {
      showToast('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-lg shadow-xl">
        <h3 className="font-serif text-xl mb-1">Modifier la transaction</h3>
        {isTransfer
          ? <p className="text-[11px] text-stone-400 mb-4">Transfert — montant, date et description appliqués aux deux legs.</p>
          : <div className="mb-5" />}
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
                  <Select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                    <option value="">— Choisir —</option>
                    {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                  </Select>
                </FormGroup>
                <FormGroup label="Compte">
                  <AccountSelect value={form.account_id} onChange={v => setForm(f => ({ ...f, account_id: v }))} accounts={accounts} logoMap={logoMap} />
                </FormGroup>
              </>
            )}
            <FormGroup label="Date">
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </FormGroup>
            {!isTransfer && (
              <FormGroup label="Moyen de paiement">
                <Select value={form.payment_method_id} onChange={e => setForm(f => ({ ...f, payment_method_id: e.target.value }))}>
                  <option value="">— Choisir —</option>
                  {paymentMethods.map(m => <option key={m.id} value={String(m.id)}>{m.icon} {m.name}</option>)}
                </Select>
              </FormGroup>
            )}
          </div>
          <FormGroup label="Notes">
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Informations complémentaires…"
              rows={2}
              className="w-full px-3 py-2 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500 transition-all resize-none"
            />
          </FormGroup>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.validated}
              onChange={e => setForm(f => ({ ...f, validated: e.target.checked }))}
              className="w-4 h-4 accent-green-500"
            />
            <span className="text-sm text-stone-700">Transaction validée</span>
          </label>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" onClick={onCancel}>Annuler</Button>
            <Button type="submit" variant="primary" disabled={isPending}>{isPending ? '…' : 'Enregistrer'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
