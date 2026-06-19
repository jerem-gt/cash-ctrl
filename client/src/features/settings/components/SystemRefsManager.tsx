import type { SystemRefsPayload } from '@cashctrl/types';
import { useTranslation } from 'react-i18next';

import { Select, showToast } from '@/components/ui';
import { useCategories } from '@/hooks/useCategories';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useSettings, useUpdateSystemRefs } from '@/hooks/useSettings';

// ─── Types ────────────────────────────────────────────────────────────────────

type SystemRefKey = keyof SystemRefsPayload;

interface RefConfig {
  key: SystemRefKey;
  type: 'category' | 'subcategory' | 'payment_method';
}

const REFS: RefConfig[] = [
  { key: 'financial_income_category_id', type: 'category' },
  { key: 'transfer_subcategory_id', type: 'subcategory' },
  { key: 'transfer_payment_method_id', type: 'payment_method' },
  { key: 'bank_fees_subcategory_id', type: 'subcategory' },
  { key: 'social_fees_subcategory_id', type: 'subcategory' },
  { key: 'prelevement_payment_method_id', type: 'payment_method' },
];

// ─── SystemRefsManager ────────────────────────────────────────────────────────

export function SystemRefsManager() {
  const { t } = useTranslation('settings');
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: categories = [], isLoading: catsLoading } = useCategories();
  const { data: paymentMethods = [], isLoading: pmsLoading } = usePaymentMethods();
  const updateSystemRefs = useUpdateSystemRefs();

  const isLoading = settingsLoading || catsLoading || pmsLoading;

  const subcategories = categories.flatMap((cat) =>
    cat.subcategories.map((sub) => ({ id: sub.id, name: `${cat.name} › ${sub.name}` })),
  );

  const handleChange = (key: SystemRefKey, rawValue: string) => {
    const value: number | null = rawValue === '' ? null : Number.parseInt(rawValue, 10);
    const payload: SystemRefsPayload = { [key]: value };
    updateSystemRefs.mutate(payload, {
      onSuccess: () => showToast(t('system_refs.success')),
      onError: (err) => showToast(err.message),
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {REFS.map((ref) => (
          <div key={ref.key} className="h-9 bg-surface-emphasis animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[10px] font-bold text-content-subtle uppercase tracking-widest">
        {t('system_refs.title')}
      </p>
      <div className="flex flex-col gap-4">
        {REFS.map((ref) => {
          const currentValue = settings?.[ref.key] ?? null;
          const selectValue = currentValue === null ? '' : String(currentValue);

          return (
            <div key={ref.key} className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-content-subtle">
                {t(`system_refs.${ref.key}`)}
              </label>
              <Select
                value={selectValue}
                onChange={(e) => handleChange(ref.key, e.target.value)}
                disabled={updateSystemRefs.isPending}
                aria-label={t(`system_refs.${ref.key}`)}
              >
                <option value="">{t('system_refs.placeholder')}</option>
                {ref.type === 'category' &&
                  categories.map((cat) => (
                    <option key={cat.id} value={String(cat.id)}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                {ref.type === 'subcategory' &&
                  subcategories.map((sub) => (
                    <option key={sub.id} value={String(sub.id)}>
                      {sub.name}
                    </option>
                  ))}
                {ref.type === 'payment_method' &&
                  paymentMethods.map((pm) => (
                    <option key={pm.id} value={String(pm.id)}>
                      {pm.icon} {pm.name}
                    </option>
                  ))}
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
