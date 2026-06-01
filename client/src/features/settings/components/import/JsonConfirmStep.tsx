import { useTranslation } from 'react-i18next';

import { Button, Card } from '@/components/ui';
import { ImportErrorMessage } from '@/features/settings/components/import/Shared';

export interface JsonConfirmData {
  d: Record<string, unknown[]>;
  stats: Array<{ value: number; label: string }>;
  cats: Array<{ subcategories: unknown[] }>;
  subcatCount: number;
}

interface JsonConfirmStepProps {
  data: JsonConfirmData;
  isPending: boolean;
  errorMessage: string | null;
  onBack: () => void;
  onImport: () => void;
}

export function JsonConfirmStep({
  data,
  isPending,
  errorMessage,
  onBack,
  onImport,
}: Readonly<JsonConfirmStepProps>) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-4 flex-wrap">
        {data.stats.map(({ value, label }) => (
          <div
            key={label}
            className="flex-1 min-w-22.5 bg-white border border-black/[0.07] rounded-2xl p-4 shadow-sm text-center"
          >
            <p className="text-2xl font-display text-stone-800">{value}</p>
            <p className="text-xs text-stone-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <Card>
        <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-3">
          {t('import.confirm_content_title')}
        </p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm text-stone-600">
          <span>{t('import.confirm_categories')}</span>
          <span className="text-stone-800 font-medium">
            {t('import.confirm_categories_count', {
              count: data.cats.length,
              subcount: data.subcatCount,
            })}
          </span>
          <span>{t('import.confirm_payment_methods')}</span>
          <span className="text-stone-800 font-medium">
            {(data.d.payment_methods ?? []).length}
          </span>
          <span>{t('import.confirm_account_types')}</span>
          <span className="text-stone-800 font-medium">{(data.d.account_types ?? []).length}</span>
          <span>{t('import.confirm_stock_positions')}</span>
          <span className="text-stone-800 font-medium">
            {(data.d.stock_positions ?? []).length}
          </span>
        </div>
        <p className="text-xs text-stone-400 mt-4">{t('import.confirm_note')}</p>
      </Card>

      {errorMessage && <ImportErrorMessage message={errorMessage} />}

      <div className="flex justify-between">
        <Button onClick={onBack}>{tc('back')}</Button>
        <Button variant="primary" onClick={onImport} disabled={isPending}>
          {isPending ? t('import.importing') : t('import.import_btn')}
        </Button>
      </div>
    </div>
  );
}
