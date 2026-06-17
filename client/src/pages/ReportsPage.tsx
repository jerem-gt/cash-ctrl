import { Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, Empty, Metric, Skeleton } from '@/components/ui';
import { AccountSelect } from '@/features/accounts/components/AccountSelect';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useLogoMap } from '@/hooks/useLogoMap';
import { useReport, useReportYears } from '@/hooks/useReport';
import { useProfitability } from '@/hooks/useStats';
import { generateColor } from '@/lib/colors';
import { fmt, fmtMonthShort } from '@/lib/format';

import { buildCatComparison, CategoryComparisonCard } from './reports/CategoryComparisonCard';
import { CategoryPieCard } from './reports/CategoryPieCard';
import { ComparisonSummaryCard } from './reports/ComparisonSummaryCard';
import { MonthlyChartCard } from './reports/MonthlyChartCard';
import { SectionLabel } from './reports/SectionLabel';
import { StockGainsCard } from './reports/StockGainsCard';

const CURRENT_YEAR = new Date().getFullYear();

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
  const accountId = accountValue === '' ? undefined : Number(accountValue);
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
      accountId === undefined ? investment : investment.filter((p) => p.account_id === accountId);
    return filtered.flatMap((p) => {
      const yr = p.yearly_returns.find((r) => r.year === String(year));
      if (!yr) return [];
      const cmpYr =
        compareYear === undefined
          ? undefined
          : p.yearly_returns.find((r) => r.year === String(compareYear));
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
              setCompareYear(e.target.value === '' ? undefined : Number(e.target.value))
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CategoryPieCard
              sectionLabel={t('section_expenses_cat')}
              data={expenseCatData}
              total={expenseTotal}
              emptyMessage={t('no_expenses')}
            />
            <CategoryPieCard
              sectionLabel={t('section_income_cat')}
              data={incomeCatData}
              total={incomeTotal}
              emptyMessage={t('no_income')}
            />
          </div>

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

          {stockGains.length > 0 && (
            <>
              <SectionLabel label={t('section_stock_gains')} />
              <StockGainsCard stockGains={stockGains} year={year} compareYear={compareYear} />
            </>
          )}
        </>
      )}
    </div>
  );
}
