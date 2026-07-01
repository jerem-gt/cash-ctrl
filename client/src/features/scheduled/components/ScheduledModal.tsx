import type { Account, RecurrenceUnit, Subcategory, WeekendHandling } from '@cashctrl/types';
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
import { AccountSelect } from '@/features/accounts/components/AccountSelect';
import { useInsuranceSupports } from '@/features/insurance/hooks/useInsurance';
import {
  buildVersementDescription,
  type FormState,
  isInsuranceAccount,
  type ScheduledMode,
} from '@/features/scheduled/lib/form';
import { TxCoreFields, type TxCoreState } from '@/features/transactions/components/TxCoreFields';
import { useAccounts } from '@/hooks/useAccounts';

type ScheduledT = ReturnType<typeof import('react-i18next').useTranslation<'scheduled'>>['t'];

function transactionFieldErrors(form: FormState): Set<string> {
  const errors = new Set<string>();
  if (!form.account_id) errors.add('account_id');
  if (!Number.parseInt(form.category_id)) errors.add('category_id');
  else if (!Number.parseInt(form.subcategory_id)) errors.add('subcategory_id');
  if (!Number.parseInt(form.payment_method_id)) errors.add('payment_method_id');
  return errors;
}

function transferFieldErrors(form: FormState): Set<string> {
  const errors = new Set<string>();
  if (!form.account_id) errors.add('account_id');
  if (!form.to_account_id) errors.add('to_account_id');
  return errors;
}

function versementFieldErrors(form: FormState): Set<string> {
  const errors = new Set<string>();
  if (!form.account_id) errors.add('account_id');
  if (!form.insurance_support_id) errors.add('insurance_support_id');
  if (!form.to_account_id) errors.add('to_account_id');
  return errors;
}

function validateModeFields(
  form: FormState,
  t: ScheduledT,
): { errors: Set<string>; message: string } | null {
  if (form.mode === 'transaction') {
    const errors = transactionFieldErrors(form);
    if (errors.size > 0) return { errors, message: t('modal.err_required') };
  }
  if (form.mode === 'transfer') {
    const errors = transferFieldErrors(form);
    if (errors.size > 0) return { errors, message: t('modal.err_transfer_accounts') };
  }
  if (form.mode === 'versement') {
    const errors = versementFieldErrors(form);
    if (errors.size > 0) return { errors, message: t('modal.err_versement_fields') };
  }
  return null;
}

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

export function ScheduledModal({
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
  const [errors, setErrors] = useState<Set<string>>(() => new Set());

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

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setErrors((prev) => {
      const s = new Set(prev);
      s.delete(k);
      return s;
    });
    setForm((f) => ({ ...f, [k]: v }));
  };

  const insuranceAccounts = accounts.filter(isInsuranceAccount);
  const regularAccounts = accounts.filter((a) => !isInsuranceAccount(a));

  const { data: supports = [] } = useInsuranceSupports(
    form.mode === 'versement' ? Number(form.account_id) || 0 : 0,
  );

  const handleModeChange = (mode: ScheduledMode) => {
    setErrors(new Set());
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

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const errs = new Set<string>();
    if (!form.amount) errs.add('amount');
    if (!form.description) errs.add('description');
    if (!form.start_date) errs.add('start_date');
    if (errs.size > 0) {
      setErrors(errs);
      showToast(t('modal.err_required'));
      return;
    }
    if (Number.parseFloat(form.amount) <= 0) {
      setErrors(new Set(['amount']));
      showToast(t('modal.err_amount'));
      return;
    }
    const modeErr = validateModeFields(form, t);
    if (modeErr) {
      setErrors(modeErr.errors);
      showToast(modeErr.message);
      return;
    }
    setErrors(new Set());
    onSave(form);
  };

  return (
    <ModalFrame
      title={title}
      size="2xl"
      onClose={isPending ? undefined : onCancel}
      footer={
        <>
          <Button type="button" onClick={onCancel}>
            {tc('cancel')}
          </Button>
          <Button type="submit" form="scheduled-modal-form" variant="primary" disabled={isPending}>
            {isPending ? tc('loading') : tc('save')}
          </Button>
        </>
      }
    >
      <form id="scheduled-modal-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Sélecteur de mode */}
        <div className="flex gap-1 bg-surface-emphasis rounded-xl p-1">
          {(['transaction', 'transfer', 'versement'] as ScheduledMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleModeChange(m)}
              className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-lg transition-all ${
                form.mode === m
                  ? 'bg-surface text-content shadow-sm'
                  : 'text-content-muted hover:text-content-secondary'
              }`}
            >
              {modeLabels[m]}
            </button>
          ))}
        </div>

        {/* Champs selon le mode */}
        {(form.mode === 'transaction' || form.mode === 'transfer') && (
          <TxCoreFields
            value={coreValue}
            onChange={(patch) => {
              setErrors((prev) => {
                const s = new Set(prev);
                Object.keys(patch).forEach((k) => s.delete(k));
                return s;
              });
              setForm((f) => ({ ...f, ...patch }));
            }}
            accounts={accounts}
            logoMap={logoMap}
            categories={categories}
            paymentMethods={paymentMethods}
            isTransfer={form.mode === 'transfer'}
            fieldErrors={errors}
          />
        )}

        {form.mode === 'versement' && (
          <VersementFields
            form={form}
            patch={(updates) => {
              setErrors((prev) => {
                const s = new Set(prev);
                Object.keys(updates).forEach((k) => s.delete(k));
                return s;
              });
              setForm((f) => ({ ...f, ...updates }));
            }}
            insuranceAccounts={insuranceAccounts}
            regularAccounts={regularAccounts}
            logoMap={logoMap}
            supports={supports}
            fieldErrors={errors}
          />
        )}

        {/* Récurrence */}
        <div className="border border-line-subtle rounded-xl p-4 space-y-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-content-subtle">
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
                className="flex items-center gap-1.5 cursor-pointer text-sm text-content-secondary select-none"
              >
                <input
                  type="radio"
                  name="weekend_handling"
                  value={v}
                  checked={form.weekend_handling === v}
                  onChange={() => set('weekend_handling', v)}
                  className="accent-brand-500"
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
              error={errors.has('start_date')}
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
              className="w-4 h-4 accent-brand-500"
            />
            <span className="text-sm text-content-secondary">{t('modal.active_label')}</span>
          </label>
        </div>

        {/* Notes */}
        <FormGroup label={t('modal.notes_label')}>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder={t('modal.notes_placeholder')}
            rows={2}
            className="w-full px-3 py-2 text-sm bg-surface-muted border border-line rounded-lg outline-none focus:border-brand-500 transition-all resize-none"
          />
        </FormGroup>
      </form>
    </ModalFrame>
  );
}

// ─── Champs spécifiques Versement ─────────────────────────────────────────────

interface VersementFieldsProps {
  form: FormState;
  patch: (updates: Partial<FormState>) => void;
  insuranceAccounts: Account[];
  regularAccounts: Account[];
  logoMap: Record<string, string | null>;
  supports: { id: number; name: string; type: string }[];
  fieldErrors?: Set<string>;
}

function VersementFields({
  form,
  patch,
  insuranceAccounts,
  regularAccounts,
  logoMap,
  supports,
  fieldErrors,
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
            error={fieldErrors?.has('account_id')}
          />
        </FormGroup>
        <FormGroup label={t('versement.support_label')}>
          <Select
            value={form.insurance_support_id}
            onChange={handleSupportChange}
            disabled={!form.account_id || supports.length === 0}
            error={fieldErrors?.has('insurance_support_id')}
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
            error={fieldErrors?.has('to_account_id')}
          />
        </FormGroup>
        <div className="flex gap-3">
          <FormGroup label={tc('amount')} className="flex-1">
            <DecimalInput
              value={form.amount}
              onChange={(e) => patch({ amount: e.target.value })}
              placeholder="0,00"
              error={fieldErrors?.has('amount')}
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
          error={fieldErrors?.has('description')}
        />
      </FormGroup>
    </div>
  );
}
