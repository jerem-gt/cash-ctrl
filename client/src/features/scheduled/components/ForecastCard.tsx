import type { Account, ForecastAccount } from '@cashctrl/types';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardTitle, Empty, Skeleton, Tabs } from '@/components/ui';
import { AccountBadge } from '@/features/accounts/components/AccountBadge';
import { useForecast } from '@/features/scheduled/hooks/useForecast';
import { fmtDate } from '@/lib/format';

const ForecastAreaChart = lazy(() => import('@/components/charts/ForecastAreaChart'));

export type AccountFilter = number | 'all';

interface Props {
  accounts: Account[];
  logoMap: Record<string, string | null>;
  selected: AccountFilter;
  onSelect: (id: AccountFilter) => void;
  /** false quand la page impose déjà une sélection (ex. highlight depuis la palette). */
  autoSelect?: boolean;
}

function pickDefaultAccount(accounts: ForecastAccount[]): AccountFilter {
  const alerts = accounts.filter((a) => a.goes_negative_on !== null);
  let result: AccountFilter;
  if (alerts.length === 0) {
    result = 'all';
  } else {
    const nearest = alerts.reduce(
      (min, a) => (a.goes_negative_on! < min.goes_negative_on! ? a : min),
      alerts[0],
    );
    result = nearest.account_id;
  }
  return result;
}

const CHIP_BASE =
  'relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors';
const CHIP_ACTIVE = 'bg-brand-600 border-brand-600 text-white';
const CHIP_INACTIVE = 'bg-surface-muted border-line text-content-muted hover:bg-surface-emphasis';

export function ForecastCard({
  accounts,
  logoMap,
  selected,
  onSelect,
  autoSelect = true,
}: Readonly<Props>) {
  const { t } = useTranslation('scheduled');
  const [horizon, setHorizon] = useState<30 | 90>(90);
  const { data, isLoading } = useForecast(horizon);
  const initializedRef = useRef(false);

  const forecastAccounts = data?.accounts ?? [];

  useEffect(() => {
    if (!data) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (autoSelect) onSelect(pickDefaultAccount(data.accounts));
      return;
    }
    const stillPresent = data.accounts.some((a) => a.account_id === selected);
    if (selected !== 'all' && !stillPresent) onSelect('all');
  }, [data, selected, onSelect, autoSelect]);

  const logoFor = (accountId: number): string | null => {
    const acc = accounts.find((a) => a.id === accountId);
    return acc?.bank ? (logoMap[acc.bank] ?? null) : null;
  };

  const selectedAccount =
    selected === 'all' ? undefined : forecastAccounts.find((a) => a.account_id === selected);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <CardTitle>{t('forecast.title')}</CardTitle>
        <Tabs
          tabs={[
            { key: '30', label: t('forecast.horizon_30') },
            { key: '90', label: t('forecast.horizon_90') },
          ]}
          active={String(horizon)}
          onChange={(key) => setHorizon(key === '30' ? 30 : 90)}
        />
      </div>

      {!isLoading && forecastAccounts.length === 0 ? (
        <Empty>{t('forecast.no_forecast')}</Empty>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => onSelect('all')}
              className={`${CHIP_BASE} ${selected === 'all' ? CHIP_ACTIVE : CHIP_INACTIVE}`}
            >
              {t('forecast.chip_all')}
            </button>
            {forecastAccounts.map((a) => (
              <button
                key={a.account_id}
                type="button"
                onClick={() => onSelect(a.account_id)}
                className={`${CHIP_BASE} ${selected === a.account_id ? CHIP_ACTIVE : CHIP_INACTIVE}`}
              >
                <AccountBadge name={a.account_name} logo={logoFor(a.account_id)} />
                {a.goes_negative_on !== null && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-danger border border-surface"
                  />
                )}
              </button>
            ))}
          </div>

          {selectedAccount ? (
            <>
              <Suspense fallback={<Skeleton className="h-48" />}>
                <ForecastAreaChart
                  points={selectedAccount.points}
                  goesNegativeOn={selectedAccount.goes_negative_on}
                  label={t('forecast.balance_label')}
                />
              </Suspense>
              {selectedAccount.goes_negative_on && (
                <p className="text-xs text-danger mt-2">
                  {t('forecast.negative_alert', {
                    date: fmtDate(selectedAccount.goes_negative_on),
                  })}
                </p>
              )}
            </>
          ) : (
            <Empty>{t('forecast.empty_selection')}</Empty>
          )}
        </>
      )}
    </Card>
  );
}
