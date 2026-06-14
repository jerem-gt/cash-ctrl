import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  DecimalInput,
  FormGroup,
  Input,
  ModalFrame,
  Select,
  showToast,
} from '@/components/ui';
import { BankSelect } from '@/features/accounts/components/BankSelect';
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

export function AccountModal(props: Readonly<Props>) {
  const { t } = useTranslation('accounts');
  const { t: tc } = useTranslation('common');
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
  const [errors, setErrors] = useState<Set<string>>(new Set());

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const errs = new Set<string>();
    if (!form.name.trim()) errs.add('name');
    if (!isEdit && !form.bank_id) errs.add('bank_id');
    if (errs.size > 0) {
      setErrors(errs);
      if (errs.has('name')) showToast(t('modal.err_no_name'));
      else showToast(t('modal.err_no_bank'));
      return;
    }
    setErrors(new Set());
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
        opening_date: form.opening_date || null,
      },
      {
        onSuccess: () => {
          showToast(t('modal.success_create'));
          onClose();
        },
        onError: (e) => showToast(e.message),
      },
    );
  };

  const isPending = isEdit ? (props as EditProps).isPending : createAccount.isPending;

  let submitLabel: string;
  if (isPending) {
    submitLabel = tc('loading');
  } else if (isEdit) {
    submitLabel = t('modal.submit_edit');
  } else {
    submitLabel = t('modal.submit_create');
  }

  return (
    <ModalFrame
      title={isEdit ? t('modal.title_edit') : t('modal.title_create')}
      onClose={isPending ? undefined : onClose}
      footer={
        <>
          <Button type="button" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button type="submit" form="account-modal-form" variant="primary" disabled={isPending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id="account-modal-form" onSubmit={handleSubmit} className="space-y-3">
        <FormGroup label={t('modal.name')}>
          <Input
            type="text"
            value={form.name}
            onChange={(e) => {
              setErrors((p) => {
                const s = new Set(p);
                s.delete('name');
                return s;
              });
              setForm((f) => ({ ...f, name: e.target.value }));
            }}
            placeholder={t('modal.name_placeholder')}
            error={errors.has('name')}
          />
        </FormGroup>
        <FormGroup label={t('modal.bank')}>
          <BankSelect
            value={form.bank_id}
            onChange={(v) => {
              setErrors((p) => {
                const s = new Set(p);
                s.delete('bank_id');
                return s;
              });
              setForm((f) => ({ ...f, bank_id: v }));
            }}
            banks={banks}
            error={errors.has('bank_id')}
          />
        </FormGroup>
        <FormGroup label={t('modal.type')}>
          <Select
            value={effectiveAccountTypeId}
            onChange={(e) => setForm((f) => ({ ...f, account_type_id: e.target.value }))}
          >
            {accountTypes.map((accountType) => (
              <option key={accountType.id} value={String(accountType.id)}>
                {accountType.name}
              </option>
            ))}
          </Select>
        </FormGroup>
        <FormGroup label={t('modal.initial_balance')}>
          <DecimalInput
            value={form.initial_balance}
            onChange={(e) => setForm((f) => ({ ...f, initial_balance: e.target.value }))}
            placeholder="0,00"
          />
        </FormGroup>
        <FormGroup label={t('modal.opening_date')}>
          <Input
            type="date"
            aria-label="opening-date"
            value={form.opening_date}
            onChange={(e) => setForm((f) => ({ ...f, opening_date: e.target.value }))}
          />
        </FormGroup>
      </form>
    </ModalFrame>
  );
}
