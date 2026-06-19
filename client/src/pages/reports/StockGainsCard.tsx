import type { YearlyReturn } from '@cashctrl/types';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui';
import { fmt } from '@/lib/format';

interface StockGainEntry extends YearlyReturn {
  account_id: number;
  account_name: string;
  compare?: YearlyReturn;
}

function GainCell({ gain, returnPct }: Readonly<{ gain: number; returnPct: number | null }>) {
  const pos = gain >= 0;
  return (
    <>
      {pos ? '+' : ''}
      {fmt(gain)}
      {returnPct !== null && (
        <span className="ml-1 text-[10px] font-normal text-content-muted">
          ({pos ? '+' : ''}
          {returnPct.toFixed(1)} %)
        </span>
      )}
    </>
  );
}

function StockGainCompareColumns({ g }: Readonly<{ g: StockGainEntry }>) {
  const cmpGain = g.compare?.gain;
  const delta = cmpGain === undefined ? undefined : g.gain - cmpGain;
  const deltaPos = delta !== undefined && delta >= 0;

  let cmpGainColor = 'text-content-faint';
  if (cmpGain !== undefined) {
    cmpGainColor = cmpGain >= 0 ? 'text-success' : 'text-danger';
  }

  let deltaColor = 'text-content-faint';
  if (delta !== undefined) {
    deltaColor = deltaPos ? 'text-success' : 'text-danger';
  }

  return (
    <>
      <td className={`py-2 text-right tabular-nums pl-4 ${cmpGainColor}`}>
        {cmpGain === undefined ? (
          '—'
        ) : (
          <GainCell gain={cmpGain} returnPct={g.compare?.return_pct ?? null} />
        )}
      </td>
      <td className={`py-2 text-right tabular-nums font-medium ${deltaColor}`}>
        {delta === undefined ? (
          '—'
        ) : (
          <>
            {deltaPos ? '+' : ''}
            {fmt(delta)}
          </>
        )}
      </td>
    </>
  );
}

function StockGainRow({ g, showCompare }: Readonly<{ g: StockGainEntry; showCompare: boolean }>) {
  const gainPos = g.gain >= 0;
  return (
    <tr className="border-b border-line-subtle last:border-0">
      <td className="py-2 text-content-secondary">
        {g.account_name}
        {g.is_ytd && <span className="ml-1.5 text-[10px] text-content-faint">YTD</span>}
      </td>
      <td className="py-2 text-right tabular-nums text-content-muted">{fmt(g.start_value)}</td>
      <td className="py-2 text-right tabular-nums text-content-muted">{fmt(g.end_value)}</td>
      <td className="py-2 text-right tabular-nums text-content-muted">{fmt(g.net_flows)}</td>
      <td
        className={`py-2 text-right tabular-nums font-medium ${gainPos ? 'text-success' : 'text-danger'}`}
      >
        <GainCell gain={g.gain} returnPct={g.return_pct} />
      </td>
      {showCompare && <StockGainCompareColumns g={g} />}
    </tr>
  );
}

interface StockGainsCardProps {
  stockGains: StockGainEntry[];
  year: number;
  compareYear: number | undefined;
}

export function StockGainsCard({ stockGains, year, compareYear }: Readonly<StockGainsCardProps>) {
  const { t } = useTranslation('reports');
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-content-faint border-b border-line-subtle">
            <th className="font-medium pb-2">{t('stock_account')}</th>
            <th className="font-medium pb-2 text-right">{t('stock_start')}</th>
            <th className="font-medium pb-2 text-right">{t('stock_end')}</th>
            <th className="font-medium pb-2 text-right">{t('stock_flows')}</th>
            <th className="font-medium pb-2 text-right">
              {t('stock_gain')} {year}
            </th>
            {compareYear !== undefined && (
              <>
                <th className="font-medium pb-2 text-right pl-4">
                  {t('stock_gain')} {compareYear}
                </th>
                <th className="font-medium pb-2 text-right">{t('col_delta')}</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {stockGains.map((g) => (
            <StockGainRow key={g.account_id} g={g} showCompare={compareYear !== undefined} />
          ))}
        </tbody>
      </table>
    </Card>
  );
}
