import type {
  Account,
  RecurrenceUnit,
  ScheduledTransaction,
  WeekendHandling,
} from '@cashctrl/types';

import type { ScheduledPayload } from '@/api/client';
import { today } from '@/lib/format';
import { parseAmountOrZero, parseIdOrNull } from '@/lib/parse';

import type { TScheduled } from './recurrence';

export type ScheduledMode = 'transaction' | 'transfer' | 'versement';

export type FormState = {
  mode: ScheduledMode;
  account_id: string;
  to_account_id: string;
  type: 'income' | 'expense';
  amount: string;
  description: string;
  category_id: string;
  subcategory_id: string;
  payment_method_id: string;
  insurance_support_id: string;
  insurance_fees: string;
  notes: string;
  recurrence_unit: RecurrenceUnit;
  recurrence_interval: string;
  recurrence_day: string;
  recurrence_month: string;
  weekend_handling: WeekendHandling;
  start_date: string;
  end_date: string;
  active: boolean;
};

export function isInsuranceAccount(a: Account): boolean {
  return a.envelope_type === 'life_insurance' || a.envelope_type === 'per';
}

export function emptyForm(defaultAccountId?: number): FormState {
  return {
    mode: 'transaction',
    account_id: defaultAccountId ? String(defaultAccountId) : '',
    to_account_id: '',
    type: 'expense',
    amount: '',
    description: '',
    category_id: '',
    subcategory_id: '',
    payment_method_id: '',
    insurance_support_id: '',
    insurance_fees: '0',
    notes: '',
    recurrence_unit: 'month',
    recurrence_interval: '1',
    recurrence_day: '1',
    recurrence_month: '1',
    weekend_handling: 'allow',
    start_date: today(),
    end_date: '',
    active: true,
  };
}

export function schedToForm(s: ScheduledTransaction): FormState {
  let mode: ScheduledMode = 'versement';
  if (s.insurance_support_id === null) {
    mode = s.to_account_id === null ? 'transaction' : 'transfer';
  }
  return {
    mode,
    account_id: String(s.account_id),
    to_account_id: s.to_account_id == null ? '' : String(s.to_account_id),
    type: s.type,
    amount: s.amount.toFixed(2),
    description: s.description,
    category_id: String(s.category_id ?? ''),
    subcategory_id: String(s.subcategory_id ?? ''),
    payment_method_id: String(s.payment_method_id ?? ''),
    insurance_support_id: s.insurance_support_id == null ? '' : String(s.insurance_support_id),
    insurance_fees: s.insurance_fees.toFixed(2),
    notes: s.notes ?? '',
    recurrence_unit: s.recurrence_unit,
    recurrence_interval: String(s.recurrence_interval),
    recurrence_day: s.recurrence_day == null ? '1' : String(s.recurrence_day),
    recurrence_month: s.recurrence_month == null ? '1' : String(s.recurrence_month),
    weekend_handling: s.weekend_handling,
    start_date: s.start_date,
    end_date: s.end_date ?? '',
    active: !!s.active,
  };
}

export function formToPayload(
  f: FormState,
  paymentMethods: { id: number; name: string }[],
): ScheduledPayload {
  const unit = f.recurrence_unit;
  const recurrenceDay =
    unit === 'month' || unit === 'year' ? Number.parseInt(f.recurrence_day) || 1 : null;
  const recurrenceMonth = unit === 'year' ? Number.parseInt(f.recurrence_month) || 1 : null;

  const base = {
    amount: Number.parseFloat(f.amount),
    description: f.description.trim(),
    notes: f.notes.trim() || null,
    recurrence_unit: unit,
    recurrence_interval: Number.parseInt(f.recurrence_interval) || 1,
    recurrence_day: recurrenceDay,
    recurrence_month: recurrenceMonth,
    weekend_handling: f.weekend_handling,
    start_date: f.start_date,
    end_date: f.end_date || null,
    active: f.active,
  };

  if (f.mode === 'transfer') {
    const transferPm = paymentMethods.find((m) => m.name === 'Transfert');
    return {
      ...base,
      account_id: Number.parseInt(f.account_id),
      to_account_id: parseIdOrNull(f.to_account_id),
      type: 'expense',
      subcategory_id: null,
      payment_method_id: transferPm?.id ?? null,
      insurance_support_id: null,
      insurance_fees: 0,
    };
  }

  if (f.mode === 'versement') {
    return {
      ...base,
      account_id: Number.parseInt(f.account_id),
      to_account_id: parseIdOrNull(f.to_account_id),
      type: 'expense',
      subcategory_id: null,
      payment_method_id: null,
      insurance_support_id: parseIdOrNull(f.insurance_support_id),
      insurance_fees: parseAmountOrZero(f.insurance_fees),
    };
  }

  // transaction
  return {
    ...base,
    account_id: Number.parseInt(f.account_id),
    to_account_id: null,
    type: f.type,
    subcategory_id: parseIdOrNull(f.subcategory_id),
    payment_method_id: parseIdOrNull(f.payment_method_id),
    insurance_support_id: null,
    insurance_fees: 0,
  };
}

export function buildVersementDescription(
  accountName: string,
  support: { name: string; type: string } | undefined,
  t: TScheduled,
): string {
  if (!support) return '';
  const prefix = accountName ? `${accountName} · ` : '';
  return support.type === 'uc'
    ? t('versement.desc_prefix_uc', { prefix, name: support.name })
    : t('versement.desc_prefix_euro', { prefix, name: support.name });
}
