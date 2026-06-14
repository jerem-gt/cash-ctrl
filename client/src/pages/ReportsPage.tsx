import { Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { IncomeExpenseDatum } from '@/components/charts/IncomeExpenseBarChart';
import { Card, CardTitle, Empty, Metric, Skeleton } from '@/components/ui';
import { AccountSelect } from '@/features/accounts/components/AccountSelect';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useLogoMap } from '@/hooks/useLogoMap';
import { useReport, useReportYears } from '@/hooks/useReport';
import { useProfitability } from '@/hooks/useStats';
import { generateColor } from '@/lib/colors';
import { fmt, fmtMonthShort } from '@/lib/format';
import type { YearlyReturn } from '@/types';

const ExpensesPieChart = lazy(() => import('@/components/charts/ExpensesPieChart'));
const IncomeExpenseBarChart = lazy(() => import('@/components/charts/IncomeExpenseBarChart'));

const INCOME_COLOR = '#7DBB4A';
const EXPENSE_COLOR = '#D46060';
const CURRENT_YEAR = new Date().getFullYear();

function SectionLabel({ label }: Readonly<{ label: string }>) {
  return (
    <div className="flex items-center gap-3 mt-2">
      <span className="text-[10px] font-medium uppercase tracking-widest text-content-faint whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-line-subtle" />
    </div>
  );
}

interface CategoryListProps {
  data: Array<{ name: string; value: number; fill: string | undefined }>;
  total: number;
}

function CategoryList({ data, total }: Readonly<CategoryListProps>) {
  return (
    <div className="flex flex-col gap-1.5 mt-3">
      {data.map((d) => {
        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
        return (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: d.fill }} />
            <span className="text-xs text-content-muted flex-1 truncate">{d.name || '—'}</span>
            <span className="text-xs text-content-subtle tabular-nums">{pct}%</span>
            <span className="text-xs font-medium text-content-secondary tabular-nums w-20 text-right">
              {fmt(d.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

type CatRow = { category: string; current: number; compare: number; delta: number };

function buildCatComparison(
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
  const cmpGainPos = cmpGain !== undefined && cmpGain >= 0;
  const delta = cmpGain !== undefined ? g.gain - cmpGain : undefined;
  const deltaPos = delta !== undefined && delta >= 0;

  let cmpGainColor = 'text-content-faint';
  if (cmpGain !== undefined) {
    cmpGainColor = cmpGainPos ? 'text-success' : 'text-danger';
  }

  let deltaColor = 'text-content-faint';
  if (delta !== undefined) {
    deltaColor = deltaPos ? 'text-success' : 'text-danger';
  }

  return (
    <>
      <td className={`py-2 text-right tabular-nums pl-4 ${cmpGainColor}`}>
        {cmpGain !== undefined ? (
          <GainCell gain={cmpGain} returnPct={g.compare?.return_pct ?? null} />
        ) : (
          '—'
        )}
      </td>
      <td className={`py-2 text-right tabular-nums font-medium ${deltaColor}`}>
        {delta !== undefined ? (
          <>
            {deltaPos ? '+' : ''}
            {fmt(delta)}
          </>
        ) : (
          '—'
        )}
      </td>
    </>
  );
}

interface StockGainRowProps {
  g: StockGainEntry;
  showCompare: boolean;
}

function StockGainRow({ g, showCompare }: Readonly<StockGainRowProps>) {
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

interface ComparisonSummaryCardProps {
  year: number;
  compareYear: number;
  incomeTotal: number;
  expenseTotal: number;
  bilan: number;
  compareReport: { income_total: number; expense_total: number };
}

function ComparisonSummaryCard({
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
            const isGood = positiveIsGood ? delta >= 0 : delta <= 0;
            return (
              <tr key={label} className="border-b border-line-subtle last:border-0">
                <td className="py-2 text-content-muted font-medium">{label}</td>
                <td className="py-2 text-right tabular-nums text-content-secondary font-medium">
                  {fmt(cur)}
                </td>
                <td className="py-2 text-right tabular-nums text-content-muted">{fmt(cmp)}</td>
                <td
                  className={`py-2 text-right tabular-nums font-medium ${isGood ? 'text-success' : 'text-danger'}`}
                >
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

interface MonthlyChartCardProps {
  barData: IncomeExpenseDatum[];
  compareBarData: IncomeExpenseDatum[];
  compareYear: number | undefined;
}

function MonthlyChartCard({
  barData,
  compareBarData,
  compareYear,
}: Readonly<MonthlyChartCardProps>) {
  const { t } = useTranslation('reports');
  const legendItems: [string, string, boolean][] = [
    [INCOME_COLOR, t('chart_income'), false],
    [EXPENSE_COLOR, t('chart_expenses'), false],
    ...(compareYear !== undefined
      ? [
          [INCOME_COLOR, `${t('chart_income')} ${compareYear}`, true] as [string, string, boolean],
          [EXPENSE_COLOR, `${t('chart_expenses')} ${compareYear}`, true] as [
            string,
            string,
            boolean,
          ],
        ]
      : []),
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
          compareData={compareYear !== undefined ? compareBarData : undefined}
          compareLabel={compareYear !== undefined ? String(compareYear) : undefined}
          incomeLabel={t('chart_income')}
          expenseLabel={t('chart_expenses')}
          incomeColor={INCOME_COLOR}
          expenseColor={EXPENSE_COLOR}
        />
      </Suspense>
    </Card>
  );
}

interface CategoryComparisonCardProps {
  catTab: 'expense' | 'income';
  setCatTab: (tab: 'expense' | 'income') => void;
  mergedCatData: { expense: CatRow[]; income: CatRow[] };
  year: number;
  compareYear: number;
}

function CategoryComparisonCard({
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

export default function ReportsPage() {
  const { t } = useTranslation('reports');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [compareYear, setCompareYear] = useState<number | undefined>(undefined);
  const [catTab, setCatTab] = useState<'expense' | 'income'>('expense');
  const [accountValue, setAccountValue] = useState('');

  const { data: yearOptions = [CURRENT_YEAR] } = useReportYears();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const logoMap = useLogoMap();
  const { data: profitabilityData = [] } = useProfitability();

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.closed_at), [accounts]);
  const accountId = accountValue !== '' ? Number(accountValue) : undefined;
  const { data: report, isLoading } = useReport(year, accountId);
  const { data: compareReport } = useReport(
    compareYear ?? year - 1,
    accountId,
    compareYear !== undefined,
  );

  const handleYearChange = (newYear: number) => {
    setYear(newYear);
    if (compareYear === newYear) setCompareYear(undefined);
  };

  const colorMap = useMemo(
    () => Object.fromEntries(categories.map((c, i) => [c.name, generateColor(i)])),
    [categories],
  );

  const barData = useMemo(
    () =>
      (report?.monthly ?? []).map((m) => ({
        month: fmtMonthShort(new Date(`${m.month}-01T00:00:00`)),
        Revenus: m.income,
        Depenses: m.expense,
      })),
    [report],
  );

  const expenseCatData = useMemo(
    () =>
      (report?.expense_by_category ?? []).map((d) => ({
        name: d.category,
        value: d.amount,
        fill: colorMap[d.category],
      })),
    [report, colorMap],
  );

  const incomeCatData = useMemo(
    () =>
      (report?.income_by_category ?? []).map((d) => ({
        name: d.category,
        value: d.amount,
        fill: colorMap[d.category],
      })),
    [report, colorMap],
  );

  const compareBarData = useMemo(
    () =>
      (compareReport?.monthly ?? []).map((m) => ({
        month: fmtMonthShort(new Date(`${m.month}-01T00:00:00`)),
        Revenus: m.income,
        Depenses: m.expense,
      })),
    [compareReport],
  );

  const mergedCatData = useMemo(
    () => ({
      expense: buildCatComparison(
        report?.expense_by_category ?? [],
        compareReport?.expense_by_category,
      ),
      income: buildCatComparison(
        report?.income_by_category ?? [],
        compareReport?.income_by_category,
      ),
    }),
    [report, compareReport],
  );

  const stockGains = useMemo(() => {
    const investment = profitabilityData.filter((p) => p.envelope_type === 'investment');
    const filtered =
      accountId != null ? investment.filter((p) => p.account_id === accountId) : investment;
    return filtered.flatMap((p) => {
      const yr = p.yearly_returns.find((r) => r.year === String(year));
      if (!yr) return [];
      const cmpYr =
        compareYear !== undefined
          ? p.yearly_returns.find((r) => r.year === String(compareYear))
          : undefined;
      return [{ account_id: p.account_id, account_name: p.account_name, ...yr, compare: cmpYr }];
    });
  }, [profitabilityData, year, compareYear, accountId]);

  const incomeTotal = report?.income_total ?? 0;
  const expenseTotal = report?.expense_total ?? 0;
  const bilan = incomeTotal - expenseTotal;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl tracking-tight">{t('title')}</h2>
        <p className="text-sm text-content-subtle mt-0.5">{t('subtitle')}</p>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-content-muted whitespace-nowrap">{t('filter_year')}</label>
          <select
            value={year}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="h-8 px-2 text-sm text-content-secondary bg-surface border border-line rounded-lg outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-content-muted whitespace-nowrap">
            {t('filter_account')}
          </label>
          <div className="w-52">
            <AccountSelect
              id="report-account"
              value={accountValue}
              onChange={setAccountValue}
              accounts={activeAccounts}
              logoMap={logoMap}
              placeholder={t('filter_all_accounts')}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-content-muted whitespace-nowrap">
            {t('compare_with')}
          </label>
          <select
            value={compareYear ?? ''}
            onChange={(e) =>
              setCompareYear(e.target.value !== '' ? Number(e.target.value) : undefined)
            }
            className="h-8 px-2 text-sm text-content-secondary bg-surface border border-line rounded-lg outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all"
          >
            <option value="">{t('compare_none')}</option>
            {yearOptions
              .filter((y) => y !== year)
              .map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-5 animate-pulse">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} size="sm">
                <Skeleton className="h-3 w-20 mb-3" />
                <Skeleton className="h-7 w-28" />
              </Card>
            ))}
          </div>
          <Card>
            <Skeleton className="h-3 w-40 mb-4" />
            <Skeleton className="h-44" />
          </Card>
        </div>
      ) : (
        <>
          {/* Métriques */}
          <div className="grid grid-cols-3 gap-3">
            <Metric
              label={t('metric_income')}
              value={fmt(incomeTotal)}
              variant="positive"
              icon={<TrendingUp size={15} />}
            />
            <Metric
              label={t('metric_expense')}
              value={fmt(expenseTotal)}
              variant="negative"
              icon={<TrendingDown size={15} />}
            />
            <Metric
              label={t('metric_balance')}
              value={fmt(bilan)}
              variant={bilan >= 0 ? 'positive' : 'negative'}
              icon={<Scale size={15} />}
            />
          </div>

          {/* Récapitulatif de comparaison */}
          {compareYear !== undefined && compareReport && (
            <>
              <SectionLabel label={t('section_summary')} />
              <ComparisonSummaryCard
                year={year}
                compareYear={compareYear}
                incomeTotal={incomeTotal}
                expenseTotal={expenseTotal}
                bilan={bilan}
                compareReport={compareReport}
              />
            </>
          )}

          {/* Revenus vs Dépenses par mois */}
          {barData.some((d) => d.Revenus > 0 || d.Depenses > 0) ? (
            <>
              <SectionLabel label={t('section_monthly')} />
              <MonthlyChartCard
                barData={barData}
                compareBarData={compareBarData}
                compareYear={compareYear}
              />
            </>
          ) : (
            <Card>
              <Empty>{t('no_data')}</Empty>
            </Card>
          )}

          {/* Répartitions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Dépenses par catégorie */}
            <div>
              <SectionLabel label={t('section_expenses_cat')} />
              <Card className="mt-3">
                <CardTitle>{fmt(expenseTotal)}</CardTitle>
                {expenseCatData.length === 0 ? (
                  <Empty>{t('no_expenses')}</Empty>
                ) : (
                  <>
                    <Suspense fallback={<Skeleton className="h-44" />}>
                      <ExpensesPieChart data={expenseCatData} />
                    </Suspense>
                    <CategoryList data={expenseCatData} total={expenseTotal} />
                  </>
                )}
              </Card>
            </div>

            {/* Revenus par catégorie */}
            <div>
              <SectionLabel label={t('section_income_cat')} />
              <Card className="mt-3">
                <CardTitle>{fmt(incomeTotal)}</CardTitle>
                {incomeCatData.length === 0 ? (
                  <Empty>{t('no_income')}</Empty>
                ) : (
                  <>
                    <Suspense fallback={<Skeleton className="h-44" />}>
                      <ExpensesPieChart data={incomeCatData} />
                    </Suspense>
                    <CategoryList data={incomeCatData} total={incomeTotal} />
                  </>
                )}
              </Card>
            </div>
          </div>
          {/* Comparaison des catégories */}
          {compareYear !== undefined && compareReport && (
            <>
              <SectionLabel label={t('section_cat_comparison')} />
              <CategoryComparisonCard
                catTab={catTab}
                setCatTab={setCatTab}
                mergedCatData={mergedCatData}
                year={year}
                compareYear={compareYear}
              />
            </>
          )}

          {/* Performance boursière */}
          {stockGains.length > 0 && (
            <>
              <SectionLabel label={t('section_stock_gains')} />
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
                      <StockGainRow
                        key={g.account_id}
                        g={g}
                        showCompare={compareYear !== undefined}
                      />
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
