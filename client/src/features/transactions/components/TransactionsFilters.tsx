import { ChevronDown, ChevronUp, RotateCcw, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DecimalInput, Input, Select, Switch } from '@/components/ui';
import { AccountSelect } from '@/features/accounts/components/AccountSelect';
import { parseIdOrUndefined } from '@/lib/parse';
import { useDebouncedSync } from '@/lib/useDebouncedSync';
import { Account, Category, Filters, PaymentMethod, Subcategory } from '@/types.ts';

// Champ libellé du panneau de filtres avancés : libellé court au-dessus du contrôle.
function Field({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] font-medium uppercase tracking-wide text-content-subtle">
        {label}
      </span>
      {children}
    </div>
  );
}

interface FilterProps {
  filters: Filters;
  onFilterChange: (patch: Partial<Filters>) => void;
  categories: Category[];
  subcategories: Subcategory[];
  accounts: Account[];
  paymentMethods: PaymentMethod[];
  logoMap: Record<string, string | null>;
  showAccountSelect?: boolean;
  rightSlot?: ReactNode;
}

const ADVANCED_KEYS: (keyof Filters)[] = [
  'account_id',
  'category_id',
  'subcategory_id',
  'date_from',
  'date_to',
  'amount_min',
  'amount_max',
  'payment_method_id',
  'validated',
];

export const TransactionsFilters = ({
  filters,
  onFilterChange,
  categories,
  subcategories,
  accounts,
  paymentMethods,
  logoMap,
  showAccountSelect,
  rightSlot,
}: FilterProps) => {
  const { t } = useTranslation('transactions');
  const [descriptionInput, setDescriptionInput] = useState(filters.description_contains ?? '');
  const [amountMinInput, setAmountMinInput] = useState(filters.amount_min?.toString() ?? '');
  const [amountMaxInput, setAmountMaxInput] = useState(filters.amount_max?.toString() ?? '');
  const [open, setOpen] = useState(false);

  const activeAdvancedCount = ADVANCED_KEYS.filter((k) => {
    if (!showAccountSelect && k === 'account_id') return false;
    return filters[k] != null;
  }).length;

  useDebouncedSync(
    descriptionInput,
    (s) => s.trim() || undefined,
    filters.description_contains ?? undefined,
    (value) => onFilterChange({ description_contains: value }),
    300,
  );

  useDebouncedSync(
    amountMinInput,
    (s) => {
      const v = Number.parseFloat(s);
      return s.trim() && !Number.isNaN(v) ? v : undefined;
    },
    filters.amount_min,
    (value) => onFilterChange({ amount_min: value }),
    400,
  );

  useDebouncedSync(
    amountMaxInput,
    (s) => {
      const v = Number.parseFloat(s);
      return s.trim() && !Number.isNaN(v) ? v : undefined;
    },
    filters.amount_max,
    (value) => onFilterChange({ amount_max: value }),
    400,
  );

  const resetAdvanced = () => {
    setAmountMinInput('');
    setAmountMaxInput('');
    onFilterChange(Object.fromEntries(ADVANCED_KEYS.map((k) => [k, undefined])));
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Barre principale */}
      <div className="flex gap-3 flex-wrap items-center w-full">
        <div className="relative flex-1 min-w-40 max-w-72">
          <Input
            type="text"
            placeholder={t('filters.description_placeholder')}
            value={descriptionInput}
            onChange={(e) => setDescriptionInput(e.target.value)}
            className={`h-9${descriptionInput ? ' pr-8' : ''}`}
          />
          {descriptionInput && (
            <button
              type="button"
              onClick={() => {
                setDescriptionInput('');
                onFilterChange({ description_contains: undefined });
              }}
              aria-label={t('filters.clear_search')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-content-subtle hover:text-content-secondary transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <Select
          aria-label={t('filters.type_label')}
          className="flex-1 min-w-32 max-w-44"
          value={filters.type ?? ''}
          onChange={(e) =>
            onFilterChange({
              type: (e.target.value || undefined) as 'income' | 'expense' | undefined,
            })
          }
        >
          <option value="">{t('filters.all_types')}</option>
          <option value="income">{t('filters.income')}</option>
          <option value="expense">{t('filters.expense')}</option>
        </Select>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm transition-colors shrink-0 ${
            activeAdvancedCount > 0
              ? 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100'
              : 'border-line bg-surface text-content-secondary hover:bg-surface-muted'
          }`}
        >
          {t('filters.advanced_filters')}
          {activeAdvancedCount > 0 && (
            <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-brand-600 text-white text-[10px] font-medium leading-none">
              {activeAdvancedCount}
            </span>
          )}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {rightSlot && <div className="flex items-center gap-3 ml-auto">{rightSlot}</div>}
      </div>

      {/* Panneau avancé */}
      {open && (
        <div className="rounded-xl border border-line-subtle bg-surface p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
            {showAccountSelect && (
              <Field label={t('filters.field_account')}>
                <AccountSelect
                  id="filtered-account-select"
                  value={String(filters.account_id ?? '')}
                  onChange={(v) => onFilterChange({ account_id: parseIdOrUndefined(v) })}
                  accounts={accounts}
                  logoMap={logoMap}
                  placeholder={t('filters.all_accounts')}
                />
              </Field>
            )}

            <Field label={t('filters.field_category')}>
              <Select
                aria-label={t('filters.category_label')}
                value={String(filters.category_id ?? '')}
                onChange={(e) =>
                  onFilterChange({
                    category_id: parseIdOrUndefined(e.target.value),
                    subcategory_id: undefined,
                  })
                }
              >
                <option value="">{t('filters.all_categories')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('filters.field_subcategory')}>
              <Select
                aria-label={t('filters.subcategory_label')}
                disabled={!filters.category_id}
                className="disabled:opacity-50 disabled:cursor-not-allowed"
                value={String(filters.subcategory_id ?? '')}
                onChange={(e) =>
                  onFilterChange({
                    subcategory_id: parseIdOrUndefined(e.target.value),
                  })
                }
              >
                <option value="">{t('filters.all_subcategories')}</option>
                {subcategories.map((sub) => (
                  <option key={sub.id} value={String(sub.id)}>
                    {sub.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('filters.field_payment_method')}>
              <Select
                aria-label={t('filters.payment_method_label')}
                value={String(filters.payment_method_id ?? '')}
                onChange={(e) =>
                  onFilterChange({
                    payment_method_id: parseIdOrUndefined(e.target.value),
                  })
                }
              >
                <option value="">{t('filters.all_payment_methods')}</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={String(pm.id)}>
                    {pm.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('filters.field_period')}>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  aria-label={t('filters.date_from')}
                  className="h-9"
                  value={filters.date_from ?? ''}
                  onChange={(e) => onFilterChange({ date_from: e.target.value || undefined })}
                />
                <span className="text-content-faint shrink-0">–</span>
                <Input
                  type="date"
                  aria-label={t('filters.date_to')}
                  className="h-9"
                  value={filters.date_to ?? ''}
                  onChange={(e) => onFilterChange({ date_to: e.target.value || undefined })}
                />
              </div>
            </Field>

            <Field label={t('filters.field_amount')}>
              <div className="flex items-center gap-2">
                <DecimalInput
                  placeholder={t('filters.amount_min_ph')}
                  aria-label={t('filters.amount_min_label')}
                  className="h-9"
                  value={amountMinInput}
                  onChange={(e) => setAmountMinInput(e.target.value)}
                />
                <span className="text-content-faint shrink-0">–</span>
                <DecimalInput
                  placeholder={t('filters.amount_max_ph')}
                  aria-label={t('filters.amount_max_label')}
                  className="h-9"
                  value={amountMaxInput}
                  onChange={(e) => setAmountMaxInput(e.target.value)}
                />
              </div>
            </Field>
          </div>

          <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-line-subtle">
            <Switch
              checked={filters.validated === false}
              onChange={(checked) => onFilterChange({ validated: checked ? false : undefined })}
              label={t('filters.not_validated_only')}
            />
            {activeAdvancedCount > 0 && (
              <button
                type="button"
                onClick={resetAdvanced}
                className="flex items-center gap-1.5 text-xs font-medium text-content-muted hover:text-content transition-colors"
              >
                <RotateCcw size={13} />
                {t('filters.reset')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
