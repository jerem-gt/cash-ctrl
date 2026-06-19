import type { BalanceHistoryData } from '@cashctrl/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, Skeleton } from '@/components/ui';
import { enrichBalanceHistory } from '@/features/dashboard/lib/dashboardBalance';
import { generateColor } from '@/lib/colors.ts';

const PatrimonyBarChart = lazy(() => import('@/components/charts/PatrimonyBarChart'));
const NetBalanceLineChart = lazy(() => import('@/components/charts/NetBalanceLineChart'));

const PATRIMONY_LABEL_KEYS = {
  prets: 'patrimony_categories.prets',
  liquidites: 'patrimony_categories.liquidites',
  epargne: 'patrimony_categories.epargne',
  fonds_euros: 'patrimony_categories.fonds_euros',
  actions_uc: 'patrimony_categories.actions_uc',
} as const;

const PAGE_SIZE = 10;

type View = 'net' | 'breakdown';

interface Props {
  history: BalanceHistoryData;
}

export function WealthCard({ history }: Readonly<Props>) {
  const { t } = useTranslation('dashboard');
  const [view, setView] = useState<View>('breakdown');
  const [offset, setOffset] = useState(0);

  const labelFor = (type: string) =>
    t(PATRIMONY_LABEL_KEYS[type as keyof typeof PATRIMONY_LABEL_KEYS]);

  const total = history.data.length;
  const endIdx = Math.max(0, total - offset);
  const startIdx = Math.max(0, endIdx - PAGE_SIZE);
  const canGoBack = startIdx > 0;
  const canGoForward = offset > 0;

  const pageHistory = {
    account_types: history.account_types,
    data: history.data.slice(startIdx, endIdx),
  };
  const {
    types,
    dataWithTotal: pageData,
    negativeTypes,
    lastPositiveType,
    hasLoans,
  } = enrichBalanceHistory(pageHistory);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-medium uppercase tracking-widest text-content-subtle">
          {t('wealth_title')}
        </p>
        <div className="flex items-center gap-2">
          {total > PAGE_SIZE && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={!canGoBack}
                className="p-0.5 rounded text-content-muted hover:text-content hover:bg-surface-muted disabled:opacity-30 disabled:cursor-default transition-colors"
                aria-label="Années précédentes"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={!canGoForward}
                className="p-0.5 rounded text-content-muted hover:text-content hover:bg-surface-muted disabled:opacity-30 disabled:cursor-default transition-colors"
                aria-label="Années suivantes"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          <div className="flex text-[11px] rounded-lg overflow-hidden border border-line-subtle">
            {(['net', 'breakdown'] as View[]).map((v, i) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1 transition-colors ${i > 0 ? 'border-l border-line-subtle' : ''} ${
                  view === v
                    ? 'bg-surface-emphasis text-content font-medium'
                    : 'text-content-muted hover:text-content hover:bg-surface-muted'
                }`}
              >
                {t(v === 'net' ? 'wealth_view_net' : 'wealth_view_breakdown')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'breakdown' && types.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-3">
          {types.map((type, i) => (
            <div key={type} className="flex items-center gap-1.5 text-[11px] text-content-muted">
              <div
                className="w-2 h-2 rounded-sm shrink-0"
                style={{ background: generateColor(i) }}
              />
              {labelFor(type)}
            </div>
          ))}
        </div>
      )}

      <Suspense fallback={<Skeleton className="h-52" />}>
        {view === 'net' ? (
          <NetBalanceLineChart data={pageData} label={t('metric_total_balance')} />
        ) : (
          <PatrimonyBarChart
            data={pageData}
            types={types}
            negativeTypes={negativeTypes}
            lastPositiveType={lastPositiveType}
            hasLoans={hasLoans}
            labelFor={labelFor}
          />
        )}
      </Suspense>
    </Card>
  );
}
