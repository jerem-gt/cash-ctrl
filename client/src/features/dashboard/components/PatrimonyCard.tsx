import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardTitle, Skeleton } from '@/components/ui';
import { enrichBalanceHistory } from '@/features/dashboard/lib/dashboardBalance';
import { generateColor } from '@/lib/colors.ts';
import type { BalanceHistoryData } from '@/types';

const PatrimonyBarChart = lazy(() => import('@/components/charts/PatrimonyBarChart'));

const PATRIMONY_LABEL_KEYS = {
  prets: 'patrimony_categories.prets',
  liquidites: 'patrimony_categories.liquidites',
  epargne: 'patrimony_categories.epargne',
  fonds_euros: 'patrimony_categories.fonds_euros',
  actions_uc: 'patrimony_categories.actions_uc',
} as const;

interface Props {
  history: BalanceHistoryData;
}

export function PatrimonyCard({ history }: Readonly<Props>) {
  const { t } = useTranslation('dashboard');
  const { types, dataWithTotal, negativeTypes, lastPositiveType, hasLoans } =
    enrichBalanceHistory(history);
  const labelFor = (type: string) =>
    t(PATRIMONY_LABEL_KEYS[type as keyof typeof PATRIMONY_LABEL_KEYS]);

  return (
    <Card>
      <CardTitle>{t('patrimony_title')}</CardTitle>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-3">
        {types.map((type, i) => (
          <div key={type} className="flex items-center gap-1.5 text-[11px] text-stone-500">
            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: generateColor(i) }} />
            {labelFor(type)}
          </div>
        ))}
      </div>
      <Suspense fallback={<Skeleton className="h-60" />}>
        <PatrimonyBarChart
          data={dataWithTotal}
          types={types}
          negativeTypes={negativeTypes}
          lastPositiveType={lastPositiveType}
          hasLoans={hasLoans}
          labelFor={labelFor}
        />
      </Suspense>
    </Card>
  );
}
