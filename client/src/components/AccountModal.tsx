import { type SubmitEvent, useState } from 'react';

import { BankSelect } from '@/components/BankSelect';
import { Button, FormGroup, Input, Select, showToast } from '@/components/ui';
import { useCreateAccount } from '@/hooks/useAccounts';
import type { Account, AccountType, Bank } from '@/types';

export type AccountFormState = {
  name: string;
  bank_id: string;
  account_type_id: string;
  initial_balance: string;
  opening_date: string;
};

type BaseProps = {
  banks: Bank[];
  accountTypes: AccountType[];
  onClose: () => void;
};

type CreateProps = BaseProps & { mode: 'create' };
type EditProps = BaseProps & {
  mode: 'edit';
  account: Account;
  onSave: (data: AccountFormState) => void;
  isPending: boolean;
};

type Props = CreateProps | EditProps;

function getSubmitLabel(isPending: boolean, isEdit: boolean): string {
  if (isPending) return '…';
  return isEdit ? 'Enregistrer' : 'Créer';
}

export function AccountModal(props: Readonly<Props>) {
  const { banks, accountTypes, onClose } = props;
  const isEdit = props.mode === 'edit';

  const [form, setForm] = useState<AccountFormState>(() => {
    if (isEdit) {
      const { account } = props as EditProps;
      return {
        name: account.name,
        bank_id: String(account.bank_id ?? ''),
        account_type_id: String(account.account_type_id ?? ''),
        initial_balance: String(account.initial_balance),
        opening_date: account.opening_date ?? '',
      };
    }
    return { name: '', bank_id: '', account_type_id: '', initial_balance: '', opening_date: '' };
  });

  const effectiveAccountTypeId = form.account_type_id || String(accountTypes[0]?.id ?? '');
  const createAccount = useCreateAccount();

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('Donnez un nom au compte.');
      return;
    }
    if (!isEdit && !form.bank_id) {
      showToast('Choisissez une banque.');
      return;
    }
    if (!form.opening_date) {
      showToast("Renseignez la date d'ouverture.");
      return;
    }

    if (isEdit) {
      (props as EditProps).onSave({ ...form, account_type_id: effectiveAccountTypeId });
      return;
    }

    createAccount.mutate(
      {
        name: form.name.trim(),
        bank_id: Number.parseInt(form.bank_id) || null,
        account_type_id: Number.parseInt(effectiveAccountTypeId) || null,
        initial_balance: Number.parseFloat(form.initial_balance) || 0,
        opening_date: form.opening_date,
      },
      {
        onSuccess: () => {
          showToast('Compte créé ✓');
          onClose();
        },
        onError: (e) => showToast(e.message),
      },
    );
  };

  const isPending = isEdit ? (props as EditProps).isPending : createAccount.isPending;

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="font-serif text-xl mb-5">
          {isEdit ? 'Modifier le compte' : 'Ajouter un compte'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <FormGroup label="Nom du compte">
            <Input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex : Compte courant"
            />
          </FormGroup>
          <FormGroup label="Banque">
            <BankSelect
              value={form.bank_id}
              onChange={(v) => setForm((f) => ({ ...f, bank_id: v }))}
              banks={banks}
            />
          </FormGroup>
          <FormGroup label="Type">
            <Select
              value={effectiveAccountTypeId}
              onChange={(e) => setForm((f) => ({ ...f, account_type_id: e.target.value }))}
            >
              {accountTypes.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}
                </option>
              ))}
            </Select>
          </FormGroup>
          <FormGroup label="Solde initial (€)">
            <Input
              type="number"
              value={form.initial_balance}
              onChange={(e) => setForm((f) => ({ ...f, initial_balance: e.target.value }))}
              placeholder="0,00"
              step="0.01"
            />
          </FormGroup>
          <FormGroup label="Date d'ouverture">
            <Input
              type="date"
              aria-label="opening-date"
              value={form.opening_date}
              onChange={(e) => setForm((f) => ({ ...f, opening_date: e.target.value }))}
            />
          </FormGroup>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {getSubmitLabel(isPending, isEdit)}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
