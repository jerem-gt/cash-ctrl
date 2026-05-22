import { useState } from 'react';

import { Card, CardTitle } from '@/components/ui';
import { fmt } from '@/lib/format';
import type { AccountProfitability } from '@/types';

function formatDuration(openingDate: string): string {
  const msPerMonth = 30.44 * 24 * 3600 * 1000;
  const totalMonths = Math.floor((Date.now() - new Date(openingDate).getTime()) / msPerMonth);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${months} mois`;
  if (months === 0) return `${years} an${years > 1 ? 's' : ''}`;
  return `${years} an${years > 1 ? 's' : ''} ${months} mois`;
}

function sign(n: number): string {
  return n >= 0 ? '+' : '';
}

interface Props {
  data: AccountProfitability;
}

export function ProfitabilityCard({ data }: Props) {
  const isSavings = data.envelope_type === null;
  const gainPos = data.plus_value_absolue >= 0;
  const gainColor = gainPos ? 'text-emerald-600' : 'text-red-600';
  const [showYearly, setShowYearly] = useState(false);

  return (
    <Card>
      <CardTitle>Rendement</CardTitle>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <div className="text-xs text-stone-500 mb-0.5">Capital investi</div>
          <div className="font-semibold">{fmt(data.capital_investi)}</div>
        </div>
        <div>
          <div className="text-xs text-stone-500 mb-0.5">Valeur actuelle</div>
          <div className="font-semibold">{fmt(data.valeur_actuelle)}</div>
        </div>
        <div>
          <div className="text-xs text-stone-500 mb-0.5">Plus-value</div>
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
          <div className="text-xs text-stone-500 mb-0.5">Rendement annuel</div>
          <div className="font-semibold">
            {data.rendement_annualise_pct !== null
              ? `${sign(data.rendement_annualise_pct)}${data.rendement_annualise_pct.toFixed(2)} % / an`
              : '—'}
          </div>
          <div className="text-xs text-stone-400">{formatDuration(data.opening_date)}</div>
        </div>
      </div>

      {isSavings && (
        <p className="text-xs text-stone-400 italic mb-3">
          Estimation — plus-value calculée à partir des revenus sans virement associé (intérêts
          implicites).
        </p>
      )}

      {data.yearly_returns.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowYearly((v) => !v)}
            className="w-full flex items-center justify-between pt-2 text-[11px] font-medium text-stone-400 hover:text-stone-600 transition-colors"
          >
            <span>Détail par année ({data.yearly_returns.length})</span>
            <span>{showYearly ? '▲' : '▼'}</span>
          </button>
          {showYearly && (
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-stone-400 border-b border-stone-100">
                    <th className="text-left py-1.5 pr-4 font-normal">Année</th>
                    <th className="text-right py-1.5 pr-4 font-normal">Début</th>
                    <th className="text-right py-1.5 pr-4 font-normal">Versements nets</th>
                    <th className="text-right py-1.5 pr-4 font-normal">Gain</th>
                    <th className="text-right py-1.5 font-normal">Rendement</th>
                  </tr>
                </thead>
                <tbody>
                  {data.yearly_returns.map((yr) => {
                    const yrPos = yr.gain >= 0;
                    const yrColor = yrPos ? 'text-emerald-600' : 'text-red-600';
                    return (
                      <tr key={yr.year} className="border-b border-stone-50 last:border-0">
                        <td className="py-1.5 pr-4 font-medium">
                          {yr.year}
                          {yr.is_ytd && <span className="text-xs text-stone-400 ml-1">ytd</span>}
                        </td>
                        <td className="text-right py-1.5 pr-4 tabular-nums">
                          {fmt(yr.start_value)}
                        </td>
                        <td className="text-right py-1.5 pr-4 tabular-nums text-stone-500">
                          {yr.net_flows !== 0 ? `${sign(yr.net_flows)}${fmt(yr.net_flows)}` : '—'}
                        </td>
                        <td className={`text-right py-1.5 pr-4 tabular-nums ${yrColor}`}>
                          {sign(yr.gain)}
                          {fmt(yr.gain)}
                        </td>
                        <td className={`text-right py-1.5 tabular-nums ${yrColor}`}>
                          {yr.return_pct !== null
                            ? `${sign(yr.return_pct)}${yr.return_pct.toFixed(1)} %`
                            : '—'}
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
