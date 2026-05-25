import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ScheduledPayload } from '@/api/client';
import { ItemActions } from '@/components/ItemActions';
import {
  Button,
  Card,
  CardTitle,
  ConfirmModal,
  DecimalInput,
  FormGroup,
  Input,
  Select,
  showToast,
  Skeleton,
} from '@/components/ui';
import { AccountSelect } from '@/features/accounts/components/AccountSelect';
import { useInsuranceSupports } from '@/features/insurance/hooks/useInsurance';
import { TxCoreFields, type TxCoreState } from '@/features/transactions/components/TxCoreFields';
import {
  useCreateScheduled,
  useDeleteScheduled,
  useScheduled,
  useUpdateScheduled,
} from '@/features/transactions/hooks/useScheduled';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useLogoMap } from '@/hooks/useLogoMap';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { useTransactions } from '@/hooks/useTransactions';
import { fmtDate, fmtDec, today } from '@/lib/format';
import type {
  Account,
  RecurrenceUnit,
  ScheduledTransaction,
  Subcategory,
  WeekendHandling,
} from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TScheduled = ReturnType<typeof useTranslation<'scheduled'>>['t'];

function recurrenceLabel(s: ScheduledTransaction, t: TScheduled): string {
  const n = s.recurrence_interval;
  const unit = s.recurrence_unit;

  if (unit === 'day') {
    return n === 1 ? t('recurrence.each_day') : t('recurrence.every_n_days', { n });
  }
  if (unit === 'week') {
    return n === 1 ? t('recurrence.each_week') : t('recurrence.every_n_weeks', { n });
  }
  if (unit === 'month') {
    if (n === 1) {
      return s.recurrence_day
        ? t('recurrence.each_month_day', { day: s.recurrence_day })
        : t('recurrence.each_month');
    }
    return s.recurrence_day
      ? t('recurrence.every_n_months_day', { n, day: s.recurrence_day })
      : t('recurrence.every_n_months', { n });
  }
  // year
  const day = s.recurrence_day ?? '';
  const monthKeys = [
    t('months.1'),
    t('months.2'),
    t('months.3'),
    t('months.4'),
    t('months.5'),
    t('months.6'),
    t('months.7'),
    t('months.8'),
    t('months.9'),
    t('months.10'),
    t('months.11'),
    t('months.12'),
  ];
  const monthName = s.recurrence_month ? (monthKeys[s.recurrence_month - 1] ?? '') : '';
  if (day || monthName) {
    return n === 1
      ? t('recurrence.each_year_on', { day, month: monthName })
      : t('recurrence.every_n_years_on', { n, day, month: monthName });
  }
  return n === 1 ? t('recurrence.each_year') : t('recurrence.every_n_years', { n });
}

function isInsuranceAccount(a: Account) {
  return a.envelope_type === 'life_insurance' || a.envelope_type === 'per';
}

// ─── Form state ───────────────────────────────────────────────────────────────

type ScheduledMode = 'transaction' | 'transfer' | 'versement';

type FormState = {
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

function emptyForm(defaultAccountId?: number): FormState {
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

function schedToForm(s: ScheduledTransaction): FormState {
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

function formToPayload(
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
      to_account_id: f.to_account_id ? Number.parseInt(f.to_account_id) : null,
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
      to_account_id: f.to_account_id ? Number.parseInt(f.to_account_id) : null,
      type: 'expense',
      subcategory_id: null,
      payment_method_id: null,
      insurance_support_id: f.insurance_support_id ? Number.parseInt(f.insurance_support_id) : null,
      insurance_fees: Number.parseFloat(f.insurance_fees) || 0,
    };
  }

  // transaction
  return {
    ...base,
    account_id: Number.parseInt(f.account_id),
    to_account_id: null,
    type: f.type,
    subcategory_id: Number.parseInt(f.subcategory_id) || null,
    payment_method_id: Number.parseInt(f.payment_method_id) || null,
    insurance_support_id: null,
    insurance_fees: 0,
  };
}

// ─── Modal formulaire ─────────────────────────────────────────────────────────

interface ModalProps {
  initial: FormState;
  accounts: ReturnType<typeof useAccounts>['data'];
  logoMap: Record<string, string | null>;
  categories: { id: number; name: string; subcategories: Subcategory[] }[];
  paymentMethods: { id: number; name: string; icon: string }[];
  title: string;
  isPending: boolean;
  onSave: (f: FormState) => void;
  onCancel: () => void;
}

function ScheduledModal({
  initial,
  accounts = [],
  logoMap,
  categories,
  paymentMethods,
  title,
  isPending,
  onSave,
  onCancel,
}: Readonly<ModalProps>) {
  const { t } = useTranslation('scheduled');
  const { t: tc } = useTranslation('common');
  const [form, setForm] = useState<FormState>(initial);

  const modeLabels: Record<ScheduledMode, string> = {
    transaction: t('modal.mode_transaction'),
    transfer: t('modal.mode_transfer'),
    versement: t('modal.mode_versement'),
  };

  const monthNames: Record<number, string> = {
    1: t('months.1'),
    2: t('months.2'),
    3: t('months.3'),
    4: t('months.4'),
    5: t('months.5'),
    6: t('months.6'),
    7: t('months.7'),
    8: t('months.8'),
    9: t('months.9'),
    10: t('months.10'),
    11: t('months.11'),
    12: t('months.12'),
  };

  const weekendLabels: Record<WeekendHandling, string> = {
    allow: t('modal.weekend_allow'),
    before: t('modal.weekend_before'),
    after: t('modal.weekend_after'),
  };
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const insuranceAccounts = accounts.filter(isInsuranceAccount);
  const regularAccounts = accounts.filter((a) => !isInsuranceAccount(a));

  const { data: supports = [] } = useInsuranceSupports(
    form.mode === 'versement' ? Number(form.account_id) || 0 : 0,
  );

  const handleModeChange = (mode: ScheduledMode) => {
    setForm((f) => ({
      ...f,
      mode,
      account_id: f.mode === 'versement' && mode !== 'versement' ? '' : f.account_id,
      to_account_id: '',
      insurance_support_id: '',
    }));
  };

  const coreValue: TxCoreState = {
    type: form.type,
    amount: form.amount,
    description: form.description,
    category_id: form.category_id,
    subcategory_id: form.subcategory_id,
    account_id: form.account_id,
    to_account_id: form.to_account_id,
    payment_method_id: form.payment_method_id,
  };

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.amount || !form.description || !form.start_date) {
      showToast(t('modal.err_required'));
      return;
    }
    if (Number.parseFloat(form.amount) <= 0) {
      showToast(t('modal.err_amount'));
      return;
    }
    if (form.mode === 'transaction' && !form.account_id) {
      showToast(t('modal.err_account'));
      return;
    }
    if (form.mode === 'transfer') {
      if (!form.account_id || !form.to_account_id) {
        showToast(t('modal.err_transfer_accounts'));
        return;
      }
    }
    if (form.mode === 'versement') {
      if (!form.account_id || !form.insurance_support_id || !form.to_account_id) {
        showToast(t('modal.err_versement_fields'));
        return;
      }
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-7 w-full max-w-2xl shadow-xl my-4">
        <h3 className="font-sans text-xl mb-5">{title}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sélecteur de mode */}
          <div className="flex gap-1 bg-stone-100 rounded-xl p-1">
            {(['transaction', 'transfer', 'versement'] as ScheduledMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleModeChange(m)}
                className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-lg transition-all ${
                  form.mode === m
                    ? 'bg-white text-stone-800 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {modeLabels[m]}
              </button>
            ))}
          </div>

          {/* Champs selon le mode */}
          {form.mode === 'transaction' && (
            <TxCoreFields
              value={coreValue}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              accounts={accounts}
              logoMap={logoMap}
              categories={categories}
              paymentMethods={paymentMethods}
              isTransfer={false}
            />
          )}

          {form.mode === 'transfer' && (
            <TxCoreFields
              value={coreValue}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              accounts={accounts}
              logoMap={logoMap}
              categories={categories}
              paymentMethods={paymentMethods}
              isTransfer={true}
            />
          )}

          {form.mode === 'versement' && (
            <VersementFields
              form={form}
              patch={(updates) => setForm((f) => ({ ...f, ...updates }))}
              insuranceAccounts={insuranceAccounts}
              regularAccounts={regularAccounts}
              logoMap={logoMap}
              supports={supports}
            />
          )}

          {/* Récurrence */}
          <div className="border border-black/[0.07] rounded-xl p-4 space-y-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
              {t('modal.recurrence_title')}
            </p>
            <div className="flex gap-3 flex-wrap">
              <FormGroup label={t('modal.every_label')}>
                <Input
                  type="number"
                  value={form.recurrence_interval}
                  onChange={(e) => set('recurrence_interval', e.target.value)}
                  min="1"
                  className="w-20"
                />
              </FormGroup>
              <FormGroup label={t('modal.unit_label')}>
                <Select
                  value={form.recurrence_unit}
                  onChange={(e) => set('recurrence_unit', e.target.value as RecurrenceUnit)}
                >
                  <option value="day">{t('modal.unit_day')}</option>
                  <option value="week">{t('modal.unit_week')}</option>
                  <option value="month">{t('modal.unit_month')}</option>
                  <option value="year">{t('modal.unit_year')}</option>
                </Select>
              </FormGroup>
              {(form.recurrence_unit === 'month' || form.recurrence_unit === 'year') && (
                <FormGroup label={t('modal.day_of_month')}>
                  <Input
                    type="number"
                    value={form.recurrence_day}
                    onChange={(e) => set('recurrence_day', e.target.value)}
                    min="1"
                    max="31"
                    className="w-20"
                  />
                </FormGroup>
              )}
              {form.recurrence_unit === 'year' && (
                <FormGroup label={t('modal.month_label')}>
                  <Select
                    value={form.recurrence_month}
                    onChange={(e) => set('recurrence_month', e.target.value)}
                  >
                    {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const).map((num) => (
                      <option key={num} value={num}>
                        {monthNames[num]}
                      </option>
                    ))}
                  </Select>
                </FormGroup>
              )}
            </div>

            {/* Week-end */}
            <div className="flex gap-4 flex-wrap">
              {(['allow', 'before', 'after'] as WeekendHandling[]).map((v) => (
                <label
                  key={v}
                  className="flex items-center gap-1.5 cursor-pointer text-sm text-stone-700 select-none"
                >
                  <input
                    type="radio"
                    name="weekend_handling"
                    value={v}
                    checked={form.weekend_handling === v}
                    onChange={() => set('weekend_handling', v)}
                    className="accent-green-500"
                  />
                  {weekendLabels[v]}
                </label>
              ))}
            </div>
          </div>

          {/* Dates + actif */}
          <div className="flex gap-3 flex-wrap items-end">
            <FormGroup label={t('modal.start_date')}>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => set('start_date', e.target.value)}
              />
            </FormGroup>
            <FormGroup label={t('modal.end_date')}>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => set('end_date', e.target.value)}
              />
            </FormGroup>
            <label className="flex items-center gap-2 cursor-pointer select-none pb-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set('active', e.target.checked)}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm text-stone-700">{t('modal.active_label')}</span>
            </label>
          </div>

          {/* Notes */}
          <FormGroup label={t('modal.notes_label')}>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder={t('modal.notes_placeholder')}
              rows={2}
              className="w-full px-3 py-2 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500 transition-all resize-none"
            />
          </FormGroup>

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" onClick={onCancel}>
              {tc('cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? tc('loading') : tc('save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Champs spécifiques Versement ─────────────────────────────────────────────

function buildVersementDescription(
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

interface VersementFieldsProps {
  form: FormState;
  patch: (updates: Partial<FormState>) => void;
  insuranceAccounts: Account[];
  regularAccounts: Account[];
  logoMap: Record<string, string | null>;
  supports: { id: number; name: string; type: string }[];
}

function VersementFields({
  form,
  patch,
  insuranceAccounts,
  regularAccounts,
  logoMap,
  supports,
}: Readonly<VersementFieldsProps>) {
  const { t } = useTranslation('scheduled');
  const { t: tc } = useTranslation('common');
  const accountName = insuranceAccounts.find((a) => String(a.id) === form.account_id)?.name ?? '';

  const handleAvAccountChange = (v: string) => {
    patch({ account_id: v, insurance_support_id: '', description: '' });
  };

  const handleSupportChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const supportId = e.target.value;
    const support = supports.find((s) => String(s.id) === supportId);
    const autoDesc = buildVersementDescription(accountName, support, t);
    patch({ insurance_support_id: supportId, description: autoDesc });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FormGroup label={t('versement.av_account_label')}>
          <AccountSelect
            id="versement-av-account"
            value={form.account_id}
            onChange={handleAvAccountChange}
            accounts={insuranceAccounts}
            logoMap={logoMap}
            placeholder={t('versement.choose')}
          />
        </FormGroup>
        <FormGroup label={t('versement.support_label')}>
          <Select
            value={form.insurance_support_id}
            onChange={handleSupportChange}
            disabled={!form.account_id || supports.length === 0}
          >
            <option value="">{t('versement.choose')}</option>
            {supports.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name} (
                {s.type === 'euro' ? t('versement.support_euro') : t('versement.support_uc')})
              </option>
            ))}
          </Select>
        </FormGroup>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormGroup label={t('versement.source_account_label')}>
          <AccountSelect
            id="versement-source-account"
            value={form.to_account_id}
            onChange={(v) => patch({ to_account_id: v })}
            accounts={regularAccounts}
            logoMap={logoMap}
            placeholder={t('versement.choose')}
          />
        </FormGroup>
        <div className="flex gap-3">
          <FormGroup label={tc('amount')} className="flex-1">
            <DecimalInput
              value={form.amount}
              onChange={(e) => patch({ amount: e.target.value })}
              placeholder="0,00"
            />
          </FormGroup>
          <FormGroup label={tc('fees')} className="w-28">
            <DecimalInput
              value={form.insurance_fees}
              onChange={(e) => patch({ insurance_fees: e.target.value })}
              placeholder="0,00"
            />
          </FormGroup>
        </div>
      </div>
      <FormGroup label={t('versement.description_label')}>
        <Input
          type="text"
          value={form.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder={t('versement.description_placeholder')}
        />
      </FormGroup>
    </div>
  );
}

// ─── Modale transactions liées ────────────────────────────────────────────────

interface ScheduledTxModalProps {
  sched: ScheduledTransaction;
  onClose: () => void;
}

function ScheduledTxModal({ sched, onClose }: Readonly<ScheduledTxModalProps>) {
  const { t } = useTranslation('scheduled');
  const { t: tc } = useTranslation('common');
  const { data, isLoading } = useTransactions({ scheduled_id: sched.id, limit: 200 });
  const transactions = data?.data ?? [];

  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  } else if (transactions.length === 0) {
    content = <p className="text-sm text-stone-400 py-2">{t('tx_modal.no_transactions')}</p>;
  } else {
    content = (
      <div className="overflow-y-auto flex-1 divide-y divide-black/6">
        {transactions.map((tx) => (
          <div key={tx.id} className="flex items-center gap-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-stone-400">{fmtDate(tx.date)}</p>
              <p className="text-sm text-stone-700 truncate">{tx.description}</p>
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                tx.validated
                  ? 'bg-green-50 text-green-600 border border-green-200'
                  : 'bg-amber-50 text-amber-600 border border-amber-200'
              }`}
            >
              {tx.validated ? t('tx_modal.validated') : t('tx_modal.pending')}
            </span>
            <span
              className={`text-sm font-medium tabular-nums shrink-0 ${
                tx.type === 'income' ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {tx.type === 'income' ? '+' : '−'}
              {fmtDec(tx.amount)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-sans text-lg leading-tight">{sched.description}</h3>
            <p className="text-xs text-stone-400 mt-0.5">{t('tx_modal.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-lg leading-none ml-4 shrink-0"
          >
            ✕
          </button>
        </div>

        {content}

        <div className="flex justify-end mt-4 pt-3 border-t border-black/6">
          <Button type="button" onClick={onClose}>
            {tc('close')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Ligne planification ──────────────────────────────────────────────────────

interface RowProps {
  sched: ScheduledTransaction;
  accounts: { id: number; name: string }[];
  onEdit: (s: ScheduledTransaction) => void;
  onDelete: (s: ScheduledTransaction) => void;
  onViewTransactions: (s: ScheduledTransaction) => void;
}

function ScheduledRow({
  sched,
  accounts,
  onEdit,
  onDelete,
  onViewTransactions,
}: Readonly<RowProps>) {
  const { t } = useTranslation('scheduled');
  const isVersement = sched.insurance_support_id != null;
  const isTransfer = !isVersement && sched.to_account_id != null;
  const toAccount = isTransfer ? accounts.find((a) => a.id === sched.to_account_id) : null;
  const sourceAccount = isVersement ? accounts.find((a) => a.id === sched.to_account_id) : null;

  const typeColor = sched.type === 'income' ? 'text-green-800' : 'text-red-700';
  const amountColor = isTransfer || isVersement ? 'text-stone-500' : typeColor;
  const typeSign = sched.type === 'income' ? '+' : '−';
  const amountSign = isTransfer || isVersement ? '' : typeSign;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-black/6 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{sched.description}</p>
          {isTransfer && (
            <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5 font-medium shrink-0">
              {t('row.transfer_badge')}
            </span>
          )}
          {isVersement && (
            <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-200 rounded px-1.5 py-0.5 font-medium shrink-0">
              {t('row.versement_badge')}
            </span>
          )}
          {!sched.active && (
            <span className="text-[10px] bg-stone-100 text-stone-400 border border-stone-200 rounded px-1.5 py-0.5 font-medium shrink-0">
              {t('row.suspended_badge')}
            </span>
          )}
          {sched.transaction_count > 0 && (
            <button
              type="button"
              onClick={() => onViewTransactions(sched)}
              className="text-[10px] bg-stone-50 text-stone-500 border border-stone-200 rounded px-1.5 py-0.5 font-medium shrink-0 hover:bg-stone-100 hover:text-stone-700 transition-colors"
            >
              {sched.transaction_count} tx
            </button>
          )}
        </div>
        <p className="text-[11px] text-stone-400 mt-0.5">
          {recurrenceLabel(sched, t)} · {sched.account_name}
          {isTransfer && toAccount ? ` → ${toAccount.name}` : ''}
          {isVersement && sched.insurance_support_name ? ` · ${sched.insurance_support_name}` : ''}
          {isVersement && sourceAccount
            ? ` · ${t('row.from_label', { name: sourceAccount.name })}`
            : ''}
          {sched.end_date ? ` · ${t('row.until_label', { date: sched.end_date })}` : ''}
        </p>
      </div>
      <span className={`text-sm font-medium tabular-nums shrink-0 ${amountColor}`}>
        {amountSign}
        {fmtDec(sched.amount)}
      </span>
      <ItemActions onEdit={() => onEdit(sched)} onDelete={() => onDelete(sched)} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScheduledPage() {
  const { t } = useTranslation('scheduled');
  const { t: tc } = useTranslation('common');
  const { data: scheduled = [], isLoading } = useScheduled();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const createScheduled = useCreateScheduled();
  const updateScheduled = useUpdateScheduled();
  const deleteScheduled = useDeleteScheduled();

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const logoMap = useLogoMap();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ScheduledTransaction | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ScheduledTransaction | null>(null);
  const [txModalTarget, setTxModalTarget] = useState<ScheduledTransaction | null>(null);
  const [leadDays, setLeadDays] = useState<string>('');
  const [showSuspended, setShowSuspended] = useState(false);

  const settingsLeadDays = settings?.lead_days;
  const defaultLeadDays = settingsLeadDays == null ? '30' : String(settingsLeadDays);
  const displayLeadDays = leadDays === '' ? defaultLeadDays : leadDays;

  const handleSaveLeadDays = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const val = Number.parseInt(displayLeadDays);
    if (Number.isNaN(val) || val < 0 || val > 365) {
      showToast(t('lead_days.err_range'));
      return;
    }
    updateSettings.mutate(
      {
        backup_enabled: settings?.backup_enabled ?? false,
        backup_frequency_h: settings?.backup_frequency_h ?? 24,
        backup_max_files: settings?.backup_max_files ?? 7,
        backup_last_at: settings?.backup_last_at ?? null,
        lead_days: val,
      },
      {
        onSuccess: () => {
          setLeadDays('');
          showToast(t('lead_days.success'));
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  const handleCreate = (f: FormState) => {
    createScheduled.mutate(formToPayload(f, paymentMethods), {
      onSuccess: () => {
        setShowModal(false);
        showToast(t('page.create_success'));
      },
      onError: (err) => showToast(err.message),
    });
  };

  const handleUpdate = (f: FormState) => {
    if (!editTarget) return;
    updateScheduled.mutate(
      { id: editTarget.id, ...formToPayload(f, paymentMethods) },
      {
        onSuccess: () => {
          setEditTarget(null);
          showToast(t('page.update_success'));
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  const handleDelete = () => {
    if (!pendingDelete) return;
    deleteScheduled.mutate(pendingDelete.id, {
      onSuccess: () => {
        setPendingDelete(null);
        showToast(t('page.delete_success'));
      },
      onError: (err) => showToast(err.message),
    });
  };

  const activeScheduled = scheduled.filter((s) => s.active);
  const suspendedScheduled = scheduled.filter((s) => !s.active);
  const visibleScheduled = activeScheduled.length === 0 ? scheduled : activeScheduled;
  const hasSuspendedSection = activeScheduled.length > 0 && suspendedScheduled.length > 0;

  const scheduledListOrEmpty =
    scheduled.length === 0 ? (
      <p className="text-sm text-stone-400 py-2">{t('page.no_scheduled')}</p>
    ) : (
      <>
        {visibleScheduled.map((s) => (
          <ScheduledRow
            key={s.id}
            sched={s}
            accounts={accounts}
            onEdit={(s) => setEditTarget(s)}
            onDelete={(s) => setPendingDelete(s)}
            onViewTransactions={(s) => setTxModalTarget(s)}
          />
        ))}
        {hasSuspendedSection && (
          <>
            <button
              type="button"
              onClick={() => setShowSuspended((v) => !v)}
              className="w-full flex items-center justify-between px-1 py-2 bg-stone-50 border-t border-stone-100 text-[11px] font-medium text-stone-400 hover:text-stone-600 transition-colors"
            >
              <span>{t('page.suspended_section', { count: suspendedScheduled.length })}</span>
              <span>{showSuspended ? '▲' : '▼'}</span>
            </button>
            {showSuspended &&
              suspendedScheduled.map((s) => (
                <ScheduledRow
                  key={s.id}
                  sched={s}
                  accounts={accounts}
                  onEdit={(s) => setEditTarget(s)}
                  onDelete={(s) => setPendingDelete(s)}
                  onViewTransactions={(s) => setTxModalTarget(s)}
                />
              ))}
          </>
        )}
      </>
    );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-sans text-2xl tracking-tight">{t('page.title')}</h2>
        <p className="text-sm text-stone-400 mt-0.5">{t('page.subtitle')}</p>
      </div>

      {/* Paramètre global : délai d'anticipation */}
      <Card className="max-w-sm">
        <CardTitle>{t('lead_days.title')}</CardTitle>
        <p className="text-xs text-stone-400 mb-3">{t('lead_days.description')}</p>
        <form onSubmit={handleSaveLeadDays} className="flex gap-2 items-end">
          <FormGroup label={t('lead_days.label')}>
            <Input
              type="number"
              value={displayLeadDays}
              onChange={(e) => setLeadDays(e.target.value)}
              min="0"
              max="365"
              className="w-24"
            />
          </FormGroup>
          <Button type="submit" variant="primary" disabled={updateSettings.isPending}>
            {updateSettings.isPending ? tc('loading') : tc('save')}
          </Button>
        </form>
      </Card>
      <div className="flex items-center justify-end mb-4">
        <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
          {t('page.new_btn')}
        </Button>
      </div>

      {/* Liste des planifications */}
      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2.5 border-b border-black/6 last:border-0"
              >
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-4 w-16 shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          scheduledListOrEmpty
        )}
      </Card>

      {/* Modal création */}
      {showModal && (
        <ScheduledModal
          initial={emptyForm()}
          accounts={accounts}
          logoMap={logoMap}
          categories={categories}
          paymentMethods={paymentMethods}
          title={t('modal.title_create')}
          isPending={createScheduled.isPending}
          onSave={handleCreate}
          onCancel={() => setShowModal(false)}
        />
      )}

      {/* Modal édition */}
      {editTarget && (
        <ScheduledModal
          initial={schedToForm(editTarget)}
          accounts={accounts}
          logoMap={logoMap}
          categories={categories}
          paymentMethods={paymentMethods}
          title={t('modal.title_edit')}
          isPending={updateScheduled.isPending}
          onSave={handleUpdate}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {/* Modale transactions liées */}
      {txModalTarget && (
        <ScheduledTxModal sched={txModalTarget} onClose={() => setTxModalTarget(null)} />
      )}

      {/* Confirmation suppression */}
      {pendingDelete && (
        <ConfirmModal
          title={t('page.delete_title')}
          body={t('page.delete_body', { description: pendingDelete.description })}
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
          isPending={deleteScheduled.isPending}
        />
      )}
    </div>
  );
}
