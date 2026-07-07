import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardTitle, Skeleton, Tabs } from '@/components/ui';
import { useForecast } from '@/features/scheduled/hooks/useForecast';
import { useAccountBalanceHistory } from '@/hooks/useStats';
import { fmtDate } from '@/lib/format';

const ForecastAreaChart = lazy(() => import('@/components/charts/ForecastAreaChart'));

interface Props {
  accountId: number;
}

export function AccountBalanceHistoryCard({ accountId }: Readonly<Props>) {
  const { t } = useTranslation('accounts');
  const [horizon, setHorizon] = useState<30 | 90>(90);
  const { data: history, isLoading } = useAccountBalanceHistory(accountId, horizon);
  const { data: forecast } = useForecast(horizon);

  const forecastAccount = forecast?.accounts.find((a) => a.account_id === accountId);
  const pastPoints = history?.points ?? [];
  const lastPastDate = pastPoints.at(-1)?.date;

  // Les points projetés commencent à "aujourd'hui" (déjà présent côté passé) : on évite le doublon.
  const futurePoints =
    forecastAccount && lastPastDate
      ? forecastAccount.points.filter((p) => p.date > lastPastDate)
      : [];

  const points = [...pastPoints, ...futurePoints];
  const splitDate = futurePoints.length > 0 ? lastPastDate : undefined;
  const goesNegativeOn = points.find((p) => p.balance < 0)?.date ?? null;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <CardTitle>{t('balance_history.title')}</CardTitle>
        <Tabs
          tabs={[
            { key: '30', label: t('balance_history.horizon_30') },
            { key: '90', label: t('balance_history.horizon_90') },
          ]}
          active={String(horizon)}
          onChange={(key) => setHorizon(key === '30' ? 30 : 90)}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <Suspense fallback={<Skeleton className="h-48" />}>
            <ForecastAreaChart
              points={points}
              goesNegativeOn={goesNegativeOn}
              label={t('balance_history.balance_label')}
              splitDate={splitDate}
            />
          </Suspense>
          {goesNegativeOn && (
            <p className="text-xs text-danger mt-2">
              {t('balance_history.negative_alert', { date: fmtDate(goesNegativeOn) })}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
