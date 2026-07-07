import type { ForecastAccount } from '@cashctrl/types';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { CardTitle } from '@/components/ui';
import { fmt, fmtDate } from '@/lib/format';

interface Props {
  alerts: ForecastAccount[];
}

export function ForecastAlertCard({ alerts }: Readonly<Props>) {
  const { t } = useTranslation('dashboard');

  return (
    <Link
      to="/scheduled"
      className="block bg-danger-surface border border-danger/30 rounded-2xl p-5 shadow-sm hover:border-danger/50 transition-colors"
    >
      <CardTitle>
        <span className="text-danger">{t('forecast_alert_title')}</span>
      </CardTitle>
      <ul className="space-y-1.5">
        {alerts.map((a) => {
          const projected = a.points.find((p) => p.date === a.goes_negative_on)?.balance;
          return (
            <li key={a.account_id} className="flex items-center gap-2 text-sm text-danger">
              <AlertTriangle size={14} className="shrink-0" />
              <span className="flex-1 min-w-0 truncate">
                {t('forecast_alert_item', {
                  account: a.account_name,
                  date: fmtDate(a.goes_negative_on!),
                })}
              </span>
              <span className="font-semibold tabular-nums shrink-0">
                {fmt(projected ?? a.current_balance)}
              </span>
            </li>
          );
        })}
      </ul>
    </Link>
  );
}
