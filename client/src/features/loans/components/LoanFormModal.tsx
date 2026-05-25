import { type SubmitEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, DecimalInput, FormGroup, Input, Select, showToast } from '@/components/ui';
import { BankSelect } from '@/features/accounts/components/BankSelect';
import { useCreateLoan, useUpdateLoan } from '@/features/loans/hooks/useLoans';
import { useAccounts } from '@/hooks/useAccounts';
import { useBanks } from '@/hooks/useBanks';
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
  deposit_account_id: string;
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
  opening_date: '',
  start_date: addMonths(today, 1),
  principal_amount: '',
  interest_rate: '',
  duration_months: '',
  source_account_id: '',
  deposit_account_id: '',
});

export function LoanFormModal(props: Readonly<Props>) {
  const { t } = useTranslation('loans');
  const { t: tc } = useTranslation('common');
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
        opening_date: account.opening_date ?? '',
        start_date: l.start_date,
        principal_amount: l.principal_amount.toFixed(2),
        interest_rate: (l.interest_rate * 100).toLocaleString('en-US', {
          maximumFractionDigits: 4,
        }),
        duration_months: String(l.duration_months),
        source_account_id: String(l.source_account_id),
        deposit_account_id: String(l.deposit_account_id),
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
      showToast(t('form_modal.err_no_name'));
      return false;
    }
    if (!form.start_date) {
      showToast(t('form_modal.err_no_start_date'));
      return false;
    }
    const principal = Number.parseFloat(form.principal_amount);
    if (!principal || principal <= 0) {
      showToast(t('form_modal.err_invalid_amount'));
      return false;
    }
    const rate = Number.parseFloat(form.interest_rate);
    if (Number.isNaN(rate) || rate < 0) {
      showToast(t('form_modal.err_invalid_rate'));
      return false;
    }
    const months = Number.parseInt(form.duration_months);
    if (!months || months <= 0) {
      showToast(t('form_modal.err_invalid_duration'));
      return false;
    }
    if (!form.source_account_id) {
      showToast(t('form_modal.err_no_source'));
      return false;
    }
    if (!isEdit && !form.deposit_account_id) {
      showToast(t('form_modal.err_no_deposit'));
      return false;
    }
    return true;
  };

  const handleSubmit = (e: SubmitEvent) => {
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
          opening_date: form.opening_date || null,
          principal_amount: principal,
          interest_rate: rate / 100,
          duration_months: months,
          start_date: form.start_date,
          source_account_id: Number.parseInt(form.source_account_id),
          deposit_account_id: Number.parseInt(form.deposit_account_id),
        },
        {
          onSuccess: () => {
            showToast(t('form_modal.success_create'));
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
          opening_date: form.opening_date || null,
          source_account_id: Number.parseInt(form.source_account_id),
        },
        {
          onSuccess: () => {
            showToast(t('form_modal.success_edit'));
            props.onClose();
          },
          onError: (e) => showToast(e.message),
        },
      );
    }
  };

  const nonLoanAccounts = accounts.filter((a) => a.envelope_type !== 'loan' && !a.closed_at);
  const submitButtonText =
    props.mode === 'create' ? t('form_modal.submit_create') : t('form_modal.submit_edit');

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-sans text-xl mb-5">
          {props.mode === 'create' ? t('form_modal.title_create') : t('form_modal.title_edit')}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <FormGroup label={t('form_modal.name_label')}>
            <Input
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder={t('form_modal.name_placeholder')}
            />
          </FormGroup>
          <FormGroup label={t('form_modal.bank_label')}>
            <BankSelect
              value={form.bank_id}
              onChange={(v) => setForm((f) => ({ ...f, bank_id: v }))}
              banks={banks}
            />
          </FormGroup>
          <div className="grid grid-cols-2 gap-3">
            <FormGroup label={t('form_modal.subscription_date')}>
              <Input type="date" value={form.opening_date} onChange={handleOpeningDateChange} />
            </FormGroup>
            <FormGroup label={t('form_modal.first_installment')}>
              <Input
                type="date"
                value={form.start_date}
                onChange={set('start_date')}
                disabled={isEdit}
                title={isEdit ? t('form_modal.first_installment_readonly') : undefined}
              />
            </FormGroup>
          </div>
          <FormGroup label={t('form_modal.amount_label')}>
            <DecimalInput
              value={form.principal_amount}
              onChange={set('principal_amount')}
              placeholder="Ex : 200000"
              disabled={isEdit}
              title={isEdit ? t('form_modal.amount_readonly') : undefined}
            />
          </FormGroup>
          <div className="grid grid-cols-2 gap-3">
            <FormGroup label={t('form_modal.rate_label')}>
              <Input
                type="number"
                value={form.interest_rate}
                onChange={set('interest_rate')}
                placeholder={t('form_modal.rate_placeholder')}
                min="0"
                step="0.001"
                disabled={isEdit}
                title={isEdit ? t('form_modal.rate_readonly') : undefined}
              />
            </FormGroup>
            <FormGroup label={t('form_modal.duration_label')}>
              <Input
                type="number"
                value={form.duration_months}
                onChange={set('duration_months')}
                placeholder={t('form_modal.duration_placeholder')}
                min="1"
                step="1"
                disabled={isEdit}
                title={isEdit ? t('form_modal.duration_readonly') : undefined}
              />
            </FormGroup>
          </div>
          {monthlyPayment > 0 && (
            <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-stone-500 uppercase tracking-wide font-medium">
                {t('form_modal.monthly_estimate')}
              </span>
              <span className="font-sans text-xl text-stone-900">
                {monthlyPayment.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
              </span>
            </div>
          )}
          {!isEdit && (
            <FormGroup label={t('form_modal.deposit_account')}>
              <Select
                aria-label={t('form_modal.deposit_account_aria')}
                value={form.deposit_account_id}
                onChange={set('deposit_account_id')}
              >
                <option value="">{t('form_modal.choose_account')}</option>
                {nonLoanAccounts.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.name}
                    {a.bank ? ` (${a.bank})` : ''}
                  </option>
                ))}
              </Select>
            </FormGroup>
          )}
          <FormGroup label={t('form_modal.source_account')}>
            <Select
              aria-label={t('form_modal.source_account_aria')}
              value={form.source_account_id}
              onChange={set('source_account_id')}
            >
              <option value="">{t('form_modal.choose_account')}</option>
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
              {tc('cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? tc('loading') : submitButtonText}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
