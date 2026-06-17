import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui';
import { fmt } from '@/lib/format';

interface ComparisonSummaryCardProps {
  year: number;
  compareYear: number;
  incomeTotal: number;
  expenseTotal: number;
  bilan: number;
  compareReport: { income_total: number; expense_total: number };
}

export function ComparisonSummaryCard({
  year,
  compareYear,
  incomeTotal,
  expenseTotal,
  bilan,
  compareReport,
}: Readonly<ComparisonSummaryCardProps>) {
  const { t } = useTranslation('reports');
  const compareBilan = compareReport.income_total - compareReport.expense_total;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-content-faint border-b border-line-subtle">
            <th className="font-medium pb-2" />
            <th className="font-medium pb-2 text-right">{year}</th>
            <th className="font-medium pb-2 text-right">{compareYear}</th>
            <th className="font-medium pb-2 text-right">{t('col_delta')}</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              {
                label: t('summary_income'),
                cur: incomeTotal,
                cmp: compareReport.income_total,
                positiveIsGood: true,
              },
              {
                label: t('summary_expense'),
                cur: expenseTotal,
                cmp: compareReport.expense_total,
                positiveIsGood: false,
              },
              {
                label: t('summary_balance'),
                cur: bilan,
                cmp: compareBilan,
                positiveIsGood: true,
              },
            ] as const
          ).map(({ label, cur, cmp, positiveIsGood }) => {
            const delta = cur - cmp;
            let deltaColor = 'text-content-muted';
            if (delta !== 0) {
              const isGood = positiveIsGood ? delta > 0 : delta < 0;
              deltaColor = isGood ? 'text-success' : 'text-danger';
            }
            return (
              <tr key={label} className="border-b border-line-subtle last:border-0">
                <td className="py-2 text-content-muted font-medium">{label}</td>
                <td className="py-2 text-right tabular-nums text-content-secondary font-medium">
                  {fmt(cur)}
                </td>
                <td className="py-2 text-right tabular-nums text-content-muted">{fmt(cmp)}</td>
                <td className={`py-2 text-right tabular-nums font-medium ${deltaColor}`}>
                  {delta > 0 ? '+' : ''}
                  {fmt(delta)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
