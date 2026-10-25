import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Card, LINK_CLASS } from '@/components/ui';
import { categoryTransactionsUrl, yearRange } from '@/features/transactions/lib/txLinks';
import { fmt } from '@/lib/format';

import type { CatRow } from './catComparison';

export { buildCatComparison, type CatRow } from './catComparison';

interface CategoryComparisonCardProps {
  catTab: 'expense' | 'income';
  setCatTab: (tab: 'expense' | 'income') => void;
  mergedCatData: { expense: CatRow[]; income: CatRow[] };
  year: number;
  compareYear: number;
  accountId?: number;
}

export function CategoryComparisonCard({
  catTab,
  setCatTab,
  mergedCatData,
  year,
  compareYear,
  accountId,
}: Readonly<CategoryComparisonCardProps>) {
  const { t } = useTranslation('reports');
  return (
    <Card>
      <div className="flex gap-1 mb-4">
        {(['expense', 'income'] as const).map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => setCatTab(tab)}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
              catTab === tab
                ? 'bg-brand-100 text-brand-700 font-medium'
                : 'text-content-muted hover:text-content-secondary hover:bg-canvas'
            }`}
          >
            {tab === 'expense' ? t('tab_expenses') : t('tab_income')}
          </button>
        ))}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-content-faint border-b border-line-subtle">
            <th className="font-medium pb-2">{t('col_category')}</th>
            <th className="font-medium pb-2 text-right">{year}</th>
            <th className="font-medium pb-2 text-right">{compareYear}</th>
            <th className="font-medium pb-2 text-right">{t('col_delta')}</th>
          </tr>
        </thead>
        <tbody>
          {mergedCatData[catTab].map(({ category, categoryId, current, compare, delta }) => {
            const isGood = catTab === 'expense' ? delta <= 0 : delta >= 0;
            let catDeltaColor = 'text-content-muted';
            if (delta !== 0) {
              catDeltaColor = isGood ? 'text-success' : 'text-danger';
            }
            return (
              <tr key={category} className="border-b border-line-subtle last:border-0">
                <td className="py-2 text-content-secondary truncate max-w-[8rem]">
                  {categoryId === undefined ? (
                    category || '—'
                  ) : (
                    <Link
                      to={categoryTransactionsUrl({
                        type: catTab,
                        categoryId,
                        range: yearRange(year),
                        accountId,
                      })}
                      className={LINK_CLASS}
                    >
                      {category || '—'}
                    </Link>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums text-content-secondary font-medium">
                  {fmt(current)}
                </td>
                <td className="py-2 text-right tabular-nums text-content-muted">{fmt(compare)}</td>
                <td className={`py-2 text-right tabular-nums font-medium ${catDeltaColor}`}>
                  {delta >= 0 ? '+' : ''}
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
