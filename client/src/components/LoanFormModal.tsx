import { useMemo, useState } from 'react';

import { BankSelect } from '@/components/BankSelect';
import { Button, FormGroup, Input, Select, showToast } from '@/components/ui';
import { useAccounts } from '@/hooks/useAccounts';
import { useBanks } from '@/hooks/useBanks';
import { useCreateLoan, useUpdateLoan } from '@/hooks/useLoans';
import type { Account, Loan } from '@/types';

type Props =
  | { mode: 'create'; onClose: () => void }
  | { mode: 'edit'; account: Account; loan: Loan; onClose: () => void };

type FormState = {
  name: string;
  bank_id: string;
  opening_date: string;
  start_date: string;
  principal_amount: string;
  interest_rate: string;
  duration_months: string;
  source_account_id: string;
};

function addMonths(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1 + n, 1);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(Math.min(d, maxDay)).padStart(2, '0')}`;
}

function calcMonthlyPayment(principal: number, annualRate: number, months: number): number {
  if (!principal || !months) return 0;
  if (annualRate === 0) return Math.round((principal / months) * 100) / 100;
  const r = annualRate / 12;
  return Math.round(((principal * r * (1 + r) ** months) / ((1 + r) ** months - 1)) * 100) / 100;
}

const EMPTY_FORM = (today: string): FormState => ({
  name: '',
  bank_id: '',
  opening_date: today,
  start_date: addMonths(today, 1),
  principal_amount: '',
  interest_rate: '',
  duration_months: '',
  source_account_id: '',
});

export function LoanFormModal(props: Readonly<Props>) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: banks = [] } = useBanks();
  const { data: accounts = [] } = useAccounts();

  const isEdit = props.mode === 'edit';
  const loan = isEdit ? props.loan : undefined;

  const [form, setForm] = useState<FormState>(() => {
    if (isEdit) {
      const { account, loan: l } = props;
      return {
        name: account.name,
        bank_id: String(account.bank_id ?? ''),
        opening_date: account.opening_date ?? today,
        start_date: l.start_date,
        principal_amount: String(l.principal_amount),
        interest_rate: (l.interest_rate * 100).toLocaleString('en-US', {
          maximumFractionDigits: 4,
        }),
        duration_months: String(l.duration_months),
        source_account_id: String(l.source_account_id),
      };
    }
    return EMPTY_FORM(today);
  });

  const createLoan = useCreateLoan();
  const updateLoan = useUpdateLoan(loan?.id ?? 0);
  const isPending = createLoan.isPending || updateLoan.isPending;

  const monthlyPayment = useMemo(() => {
    const principal = Number.parseFloat(form.principal_amount);
    const rate = Number.parseFloat(form.interest_rate) / 100;
    const months = Number.parseInt(form.duration_months);
    return calcMonthlyPayment(principal, rate, months);
  }, [form.principal_amount, form.interest_rate, form.duration_months]);

  const set =
    (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleOpeningDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setForm((f) => ({
      ...f,
      opening_date: val,
      start_date: val ? addMonths(val, 1) : f.start_date,
    }));
  };

  const validate = (): boolean => {
    if (!form.name.trim()) {
      showToast('Donnez un nom au prêt.');
      return false;
    }
    if (!form.opening_date) {
      showToast('Renseignez la date de souscription.');
      return false;
    }
    if (!form.start_date) {
      showToast('Renseignez la date de première mensualité.');
      return false;
    }
    const principal = Number.parseFloat(form.principal_amount);
    if (!principal || principal <= 0) {
      showToast('Montant invalide.');
      return false;
    }
    const rate = Number.parseFloat(form.interest_rate);
    if (Number.isNaN(rate) || rate < 0) {
      showToast('Taux invalide.');
      return false;
    }
    const months = Number.parseInt(form.duration_months);
    if (!months || months <= 0) {
      showToast('Durée invalide.');
      return false;
    }
    if (!form.source_account_id) {
      showToast('Choisissez le compte à débiter.');
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const principal = Number.parseFloat(form.principal_amount);
    const rate = Number.parseFloat(form.interest_rate);
    const months = Number.parseInt(form.duration_months);

    if (props.mode === 'create') {
      createLoan.mutate(
        {
          name: form.name.trim(),
          bank_id: Number.parseInt(form.bank_id) || null,
          opening_date: form.opening_date,
          principal_amount: principal,
          interest_rate: rate / 100,
          duration_months: months,
          start_date: form.start_date,
          source_account_id: Number.parseInt(form.source_account_id),
        },
        {
          onSuccess: () => {
            showToast('Prêt créé ✓');
            props.onClose();
          },
          onError: (e) => showToast(e.message),
        },
      );
    } else {
      updateLoan.mutate(
        {
          name: form.name.trim(),
          bank_id: Number.parseInt(form.bank_id) || null,
          opening_date: form.opening_date,
          source_account_id: Number.parseInt(form.source_account_id),
        },
        {
          onSuccess: () => {
            showToast('Prêt mis à jour ✓');
            props.onClose();
          },
          onError: (e) => showToast(e.message),
        },
      );
    }
  };

  const nonLoanAccounts = accounts.filter((a) => !a.is_loan && !a.closed_at);

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-serif text-xl mb-5">
          {props.mode === 'create' ? 'Nouveau prêt' : 'Modifier le prêt'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <FormGroup label="Nom du prêt">
            <Input
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder="Ex : Prêt immobilier"
            />
          </FormGroup>
          <FormGroup label="Banque prêteuse">
            <BankSelect
              value={form.bank_id}
              onChange={(v) => setForm((f) => ({ ...f, bank_id: v }))}
              banks={banks}
            />
          </FormGroup>
          <div className="grid grid-cols-2 gap-3">
            <FormGroup label="Date de souscription">
              <Input type="date" value={form.opening_date} onChange={handleOpeningDateChange} />
            </FormGroup>
            <FormGroup label="1ère mensualité le">
              <Input
                type="date"
                value={form.start_date}
                onChange={set('start_date')}
                disabled={isEdit}
                title={isEdit ? 'Non modifiable après création' : undefined}
              />
            </FormGroup>
          </div>
          <FormGroup label="Montant emprunté (€)">
            <Input
              type="number"
              value={form.principal_amount}
              onChange={set('principal_amount')}
              placeholder="Ex : 200000"
              min="0"
              step="0.01"
              disabled={isEdit}
              title={isEdit ? 'Non modifiable après création' : undefined}
            />
          </FormGroup>
          <div className="grid grid-cols-2 gap-3">
            <FormGroup label="Taux annuel (%)">
              <Input
                type="number"
                value={form.interest_rate}
                onChange={set('interest_rate')}
                placeholder="Ex : 3.5"
                min="0"
                step="0.01"
                disabled={isEdit}
                title={isEdit ? 'Non modifiable après création' : undefined}
              />
            </FormGroup>
            <FormGroup label="Durée (mois)">
              <Input
                type="number"
                value={form.duration_months}
                onChange={set('duration_months')}
                placeholder="Ex : 240"
                min="1"
                step="1"
                disabled={isEdit}
                title={isEdit ? 'Non modifiable après création' : undefined}
              />
            </FormGroup>
          </div>
          {monthlyPayment > 0 && (
            <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-stone-500 uppercase tracking-wide font-medium">
                Mensualité estimée
              </span>
              <span className="font-serif text-xl text-stone-900">
                {monthlyPayment.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
              </span>
            </div>
          )}
          <FormGroup label="Compte à débiter pour les remboursements">
            <Select value={form.source_account_id} onChange={set('source_account_id')}>
              <option value="">— Choisir un compte —</option>
              {nonLoanAccounts.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.name}
                  {a.bank ? ` (${a.bank})` : ''}
                </option>
              ))}
            </Select>
          </FormGroup>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" onClick={props.onClose}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? '…' : props.mode === 'create' ? 'Créer le prêt' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
