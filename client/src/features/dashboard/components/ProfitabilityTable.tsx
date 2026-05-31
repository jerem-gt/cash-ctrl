import { useTranslation } from 'react-i18next';

import { Card, CardTitle } from '@/components/ui';
import {
  formatAnnualized,
  formatDuration,
  getGainColor,
} from '@/features/dashboard/lib/profitability';
import { fmt } from '@/lib/format';
import type { AccountProfitability } from '@/types';

interface Props {
  list: AccountProfitability[];
  now: number;
}

export function ProfitabilityTable({ list, now }: Readonly<Props>) {
  const { t } = useTranslation('dashboard');
  return (
    <Card>
      <CardTitle>{t('profitability_title')}</CardTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-stone-400 border-b border-stone-100">
              <th className="text-left py-1.5 pr-4 font-normal">{t('prof_col_account')}</th>
              <th className="text-right py-1.5 pr-4 font-normal">{t('prof_col_capital')}</th>
              <th className="text-right py-1.5 pr-4 font-normal">{t('prof_col_value')}</th>
              <th className="text-right py-1.5 pr-4 font-normal">{t('prof_col_gain')}</th>
              <th className="text-right py-1.5 pr-4 font-normal">{t('prof_col_annual')}</th>
              <th className="text-right py-1.5 font-normal">{t('prof_col_seniority')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const gainPos = p.plus_value_absolue >= 0;
              const gainColor = getGainColor(gainPos);
              return (
                <tr key={p.account_id} className="border-b border-stone-50 last:border-0">
                  <td className="py-1.5 pr-4 font-medium">{p.account_name}</td>
                  <td className="text-right py-1.5 pr-4 tabular-nums text-stone-500">
                    {fmt(p.capital_investi)}
                  </td>
                  <td className="text-right py-1.5 pr-4 tabular-nums">{fmt(p.valeur_actuelle)}</td>
                  <td className={`text-right py-1.5 pr-4 tabular-nums ${gainColor}`}>
                    {gainPos ? '+' : ''}
                    {fmt(p.plus_value_absolue)}
                  </td>
                  <td className={`text-right py-1.5 pr-4 tabular-nums ${gainColor}`}>
                    {formatAnnualized(p.rendement_annualise_pct)}
                  </td>
                  <td className="text-right py-1.5 tabular-nums text-stone-400">
                    {formatDuration(p.opening_date, now, t)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
