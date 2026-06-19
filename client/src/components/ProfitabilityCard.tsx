import type { AccountProfitability } from '@cashctrl/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardTitle } from '@/components/ui';
import { fmt } from '@/lib/format';

type TAccounts = ReturnType<typeof useTranslation<'accounts'>>['t'];

function formatDuration(openingDate: string, t: TAccounts): string {
  const msPerMonth = 30.44 * 24 * 3600 * 1000;
  const totalMonths = Math.floor((Date.now() - new Date(openingDate).getTime()) / msPerMonth);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return t('profitability.duration_months', { count: months });
  if (months === 0) return t('profitability.duration_year', { count: years });
  return t('profitability.duration_year_months', { count: years, months });
}

function sign(n: number): string {
  return n >= 0 ? '+' : '';
}

interface Props {
  data: AccountProfitability;
}

export function ProfitabilityCard({ data }: Readonly<Props>) {
  const { t } = useTranslation('accounts');
  const isSavings = data.envelope_type === 'savings';
  const gainPos = data.plus_value_absolue >= 0;
  const gainColor = gainPos ? 'text-success' : 'text-danger';
  const [showYearly, setShowYearly] = useState(false);

  return (
    <Card>
      <CardTitle>{t('profitability.title')}</CardTitle>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <div className="text-xs text-content-muted mb-0.5">{t('profitability.capital')}</div>
          <div className="font-semibold">{fmt(data.capital_investi)}</div>
        </div>
        <div>
          <div className="text-xs text-content-muted mb-0.5">{t('profitability.value')}</div>
          <div className="font-semibold">{fmt(data.valeur_actuelle)}</div>
        </div>
        <div>
          <div className="text-xs text-content-muted mb-0.5">{t('profitability.gain')}</div>
          <div className={`font-semibold ${gainColor}`}>
            {sign(data.plus_value_absolue)}
            {fmt(data.plus_value_absolue)}{' '}
            <span className="text-xs font-normal">
              ({sign(data.rendement_total_pct)}
              {data.rendement_total_pct.toFixed(1)} %)
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs text-content-muted mb-0.5">
            {t('profitability.annual_return')}
          </div>
          <div className="font-semibold">
            {data.rendement_annualise_pct === null
              ? '—'
              : `${sign(data.rendement_annualise_pct)}${data.rendement_annualise_pct.toFixed(2)} ${t('profitability.per_year')}`}
          </div>
          <div className="text-xs text-content-subtle">{formatDuration(data.opening_date, t)}</div>
        </div>
      </div>

      {isSavings && (
        <p className="text-xs text-content-subtle italic mb-3">
          {t('profitability.estimation_note')}
        </p>
      )}

      {data.yearly_returns.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowYearly((v) => !v)}
            className="w-full flex items-center justify-between pt-2 text-[11px] font-medium text-content-subtle hover:text-content-secondary transition-colors"
          >
            <span>{t('profitability.detail_btn', { count: data.yearly_returns.length })}</span>
            <span>{showYearly ? '▲' : '▼'}</span>
          </button>
          {showYearly && (
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-content-subtle border-b border-line-subtle">
                    <th className="text-left py-1.5 pr-4 font-normal">
                      {t('profitability.col_year')}
                    </th>
                    <th className="text-right py-1.5 pr-4 font-normal">
                      {t('profitability.col_start')}
                    </th>
                    <th className="text-right py-1.5 pr-4 font-normal">
                      {t('profitability.col_net_flows')}
                    </th>
                    <th className="text-right py-1.5 pr-4 font-normal">
                      {t('profitability.col_gain')}
                    </th>
                    <th className="text-right py-1.5 font-normal">
                      {t('profitability.col_return')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.yearly_returns.map((yr) => {
                    const yrPos = yr.gain >= 0;
                    const yrColor = yrPos ? 'text-success' : 'text-danger';
                    return (
                      <tr key={yr.year} className="border-b border-line-subtle last:border-0">
                        <td className="py-1.5 pr-4 font-medium">
                          {yr.year}
                          {yr.is_ytd && (
                            <span className="text-xs text-content-subtle ml-1">ytd</span>
                          )}
                        </td>
                        <td className="text-right py-1.5 pr-4 tabular-nums">
                          {fmt(yr.start_value)}
                        </td>
                        <td className="text-right py-1.5 pr-4 tabular-nums text-content-muted">
                          {yr.net_flows === 0 ? '—' : `${sign(yr.net_flows)}${fmt(yr.net_flows)}`}
                        </td>
                        <td className={`text-right py-1.5 pr-4 tabular-nums ${yrColor}`}>
                          {sign(yr.gain)}
                          {fmt(yr.gain)}
                        </td>
                        <td className={`text-right py-1.5 tabular-nums ${yrColor}`}>
                          {yr.return_pct === null
                            ? '—'
                            : `${sign(yr.return_pct)}${yr.return_pct.toFixed(1)} %`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
