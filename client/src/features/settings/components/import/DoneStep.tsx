import { useTranslation } from 'react-i18next';

import { Button, Card } from '@/components/ui';

interface QifResult {
  transactions: number;
  transfers: number;
}

interface DoneStepProps {
  qifResult: QifResult | null;
  jsonStats: { value: number; label: string }[];
  onReset: () => void;
}

export function DoneStep({ qifResult, jsonStats, onReset }: Readonly<DoneStepProps>) {
  const { t } = useTranslation('settings');

  return (
    <Card>
      <div className="text-center py-8">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="font-display text-2xl text-stone-800 mb-2">{t('import.done_title')}</h2>
        {qifResult && (
          <div className="flex justify-center gap-8 mt-6 mb-8">
            <div>
              <p className="text-3xl font-display text-stone-800">{qifResult.transactions}</p>
              <p className="text-xs text-stone-400 mt-1">{t('import.imported_transactions')}</p>
            </div>
            <div>
              <p className="text-3xl font-display text-stone-800">{qifResult.transfers}</p>
              <p className="text-xs text-stone-400 mt-1">{t('import.imported_transfers')}</p>
            </div>
          </div>
        )}
        {jsonStats.length > 0 && (
          <div className="flex justify-center flex-wrap gap-6 mt-6 mb-8">
            {jsonStats.map(({ value, label }) => (
              <div key={label}>
                <p className="text-3xl font-display text-stone-800">{value}</p>
                <p className="text-xs text-stone-400 mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-center gap-3">
          <Button onClick={onReset}>{t('import.new_import_btn')}</Button>
          <Button variant="primary" onClick={() => (globalThis.location.href = '/transactions')}>
            {t('import.view_transactions_btn')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
