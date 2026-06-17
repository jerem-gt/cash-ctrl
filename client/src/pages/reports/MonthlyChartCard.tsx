import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import type { IncomeExpenseDatum } from '@/components/charts/IncomeExpenseBarChart';
import { Card, Skeleton } from '@/components/ui';

const IncomeExpenseBarChart = lazy(() => import('@/components/charts/IncomeExpenseBarChart'));

const INCOME_COLOR = '#7DBB4A';
const EXPENSE_COLOR = '#D46060';

interface MonthlyChartCardProps {
  barData: IncomeExpenseDatum[];
  compareBarData: IncomeExpenseDatum[];
  compareYear: number | undefined;
}

export function MonthlyChartCard({
  barData,
  compareBarData,
  compareYear,
}: Readonly<MonthlyChartCardProps>) {
  const { t } = useTranslation('reports');
  const legendItems: [string, string, boolean][] = [
    [INCOME_COLOR, t('chart_income'), false],
    [EXPENSE_COLOR, t('chart_expenses'), false],
    ...(compareYear === undefined
      ? []
      : [
          [INCOME_COLOR, `${t('chart_income')} ${compareYear}`, true] as [string, string, boolean],
          [EXPENSE_COLOR, `${t('chart_expenses')} ${compareYear}`, true] as [
            string,
            string,
            boolean,
          ],
        ]),
  ];
  return (
    <Card>
      <div className="flex flex-wrap gap-4 mb-3">
        {legendItems.map(([color, label, dashed]) => (
          <div key={label} className="flex items-center gap-1.5 text-[11px] text-content-subtle">
            {dashed ? (
              <svg width="16" height="8">
                <line
                  x1="0"
                  y1="4"
                  x2="16"
                  y2="4"
                  stroke={color}
                  strokeWidth="2"
                  strokeDasharray="4 2"
                  strokeOpacity="0.6"
                />
              </svg>
            ) : (
              <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
            )}
            {label}
          </div>
        ))}
      </div>
      <Suspense fallback={<Skeleton className="h-44" />}>
        <IncomeExpenseBarChart
          data={barData}
          compareData={compareYear === undefined ? undefined : compareBarData}
          compareLabel={compareYear === undefined ? undefined : String(compareYear)}
          incomeLabel={t('chart_income')}
          expenseLabel={t('chart_expenses')}
          incomeColor={INCOME_COLOR}
          expenseColor={EXPENSE_COLOR}
        />
      </Suspense>
    </Card>
  );
}
