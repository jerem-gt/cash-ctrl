import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui';
import { fmt } from '@/lib/format';

export type CatRow = { category: string; current: number; compare: number; delta: number };

export function buildCatComparison(
  current: Array<{ category: string; amount: number }>,
  compare: Array<{ category: string; amount: number }> | undefined,
): CatRow[] {
  const compareMap = new Map((compare ?? []).map((c) => [c.category, c.amount]));
  const allCats = new Set([...current.map((c) => c.category), ...compareMap.keys()]);
  return Array.from(allCats)
    .map((cat) => {
      const cur = current.find((c) => c.category === cat)?.amount ?? 0;
      const cmp = compareMap.get(cat) ?? 0;
      return { category: cat, current: cur, compare: cmp, delta: cur - cmp };
    })
    .sort((a, b) => b.current - a.current);
}

interface CategoryComparisonCardProps {
  catTab: 'expense' | 'income';
  setCatTab: (tab: 'expense' | 'income') => void;
  mergedCatData: { expense: CatRow[]; income: CatRow[] };
  year: number;
  compareYear: number;
}

export function CategoryComparisonCard({
  catTab,
  setCatTab,
  mergedCatData,
  year,
  compareYear,
}: Readonly<CategoryComparisonCardProps>) {
  const { t } = useTranslation('reports');
  return (
    <Card>
      <div className="flex gap-1 mb-4">
        {(['expense', 'income'] as const).map((tab) => (
          <button
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
            <th className="font-medium pb-2">Catégorie</th>
            <th className="font-medium pb-2 text-right">{year}</th>
            <th className="font-medium pb-2 text-right">{compareYear}</th>
            <th className="font-medium pb-2 text-right">{t('col_delta')}</th>
          </tr>
        </thead>
        <tbody>
          {mergedCatData[catTab].map(({ category, current, compare, delta }) => {
            const isGood = catTab === 'expense' ? delta <= 0 : delta >= 0;
            let catDeltaColor = 'text-content-muted';
            if (delta !== 0) {
              catDeltaColor = isGood ? 'text-success' : 'text-danger';
            }
            return (
              <tr key={category} className="border-b border-line-subtle last:border-0">
                <td className="py-2 text-content-secondary truncate max-w-[8rem]">
                  {category || '—'}
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
