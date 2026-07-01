import type { Account, Loan } from '@cashctrl/types';
import { type SubmitEvent, useMemo, useState } from 'react';
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
import { useCreateLoan, useUpdateLoan } from '@/features/loans/hooks/useLoans';
import { useAccounts } from '@/hooks/useAccounts';
import { useBanks } from '@/hooks/useBanks';
import { today } from '@/lib/dateUtils';
import { fmtCurrency } from '@/lib/format';

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

type LoanT = ReturnType<typeof import('react-i18next').useTranslation<'loans'>>['t'];

function firstLoanErrorToast(errs: Set<string>, t: LoanT): string {
  if (errs.has('name')) return t('form_modal.err_no_name');
  if (errs.has('start_date')) return t('form_modal.err_no_start_date');
  if (errs.has('principal_amount')) return t('form_modal.err_invalid_amount');
  if (errs.has('interest_rate')) return t('form_modal.err_invalid_rate');
  if (errs.has('duration_months')) return t('form_modal.err_invalid_duration');
  if (errs.has('source_account_id')) return t('form_modal.err_no_source');
  return t('form_modal.err_no_deposit');
}

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
        interest_rate: Number((l.interest_rate * 100).toFixed(4)).toString(),
        duration_months: String(l.duration_months),
        source_account_id: String(l.source_account_id),
        deposit_account_id: String(l.deposit_account_id),
      };
    }
    return EMPTY_FORM(today());
  });

  const [errors, setErrors] = useState<Set<string>>(() => new Set());

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
    (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setErrors((prev) => {
        const s = new Set(prev);
        s.delete(key);
        return s;
      });
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  const handleOpeningDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val)
      setErrors((prev) => {
        const s = new Set(prev);
        s.delete('start_date');
        return s;
      });
    setForm((f) => ({
      ...f,
      opening_date: val,
      start_date: val ? addMonths(val, 1) : f.start_date,
    }));
  };

  const validate = (): boolean => {
    const errs = new Set<string>();
    if (!form.name.trim()) errs.add('name');
    if (!form.start_date) errs.add('start_date');
    const principal = Number.parseFloat(form.principal_amount);
    if (!principal || principal <= 0) errs.add('principal_amount');
    const rate = Number.parseFloat(form.interest_rate);
    if (Number.isNaN(rate) || rate < 0) errs.add('interest_rate');
    const months = Number.parseInt(form.duration_months);
    if (!months || months <= 0) errs.add('duration_months');
    if (!form.source_account_id) errs.add('source_account_id');
    if (!isEdit && !form.deposit_account_id) errs.add('deposit_account_id');
    if (errs.size > 0) {
      setErrors(errs);
      showToast(firstLoanErrorToast(errs, t));
      return false;
    }
    setErrors(new Set());
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
        },
      );
    }
  };

  const nonLoanAccounts = accounts.filter((a) => a.envelope_type !== 'loan' && !a.closed_at);
  const submitButtonText =
    props.mode === 'create' ? t('form_modal.submit_create') : t('form_modal.submit_edit');

  return (
    <ModalFrame
      title={props.mode === 'create' ? t('form_modal.title_create') : t('form_modal.title_edit')}
      size="lg"
      onClose={isPending ? undefined : props.onClose}
      footer={
        <>
          <Button type="button" onClick={props.onClose}>
            {tc('cancel')}
          </Button>
          <Button type="submit" form="loan-form-modal" variant="primary" disabled={isPending}>
            {isPending ? tc('loading') : submitButtonText}
          </Button>
        </>
      }
    >
      <form id="loan-form-modal" onSubmit={handleSubmit} className="space-y-3">
        <FormGroup label={t('form_modal.name_label')}>
          <Input
            type="text"
            value={form.name}
            onChange={set('name')}
            placeholder={t('form_modal.name_placeholder')}
            error={errors.has('name')}
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
              error={errors.has('start_date')}
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
            error={errors.has('principal_amount')}
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
              error={errors.has('interest_rate')}
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
              error={errors.has('duration_months')}
            />
          </FormGroup>
        </div>
        {monthlyPayment > 0 && (
          <div className="bg-surface-muted border border-line rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-content-muted uppercase tracking-wide font-medium">
              {t('form_modal.monthly_estimate')}
            </span>
            <span className="font-display text-xl text-content">{fmtCurrency(monthlyPayment)}</span>
          </div>
        )}
        {!isEdit && (
          <FormGroup label={t('form_modal.deposit_account')}>
            <Select
              aria-label={t('form_modal.deposit_account_aria')}
              value={form.deposit_account_id}
              onChange={set('deposit_account_id')}
              error={errors.has('deposit_account_id')}
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
            error={errors.has('source_account_id')}
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
      </form>
    </ModalFrame>
  );
}
