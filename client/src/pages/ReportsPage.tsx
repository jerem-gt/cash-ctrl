import { Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardTitle, Empty, Metric, Skeleton } from '@/components/ui';
import { AccountSelect } from '@/features/accounts/components/AccountSelect';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useLogoMap } from '@/hooks/useLogoMap';
import { useReport, useReportYears } from '@/hooks/useReport';
import { useProfitability } from '@/hooks/useStats';
import { generateColor } from '@/lib/colors';
import { fmt, fmtMonthShort } from '@/lib/format';

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

export default function ReportsPage() {
  const { t } = useTranslation('reports');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [accountValue, setAccountValue] = useState('');

  const { data: yearOptions = [CURRENT_YEAR] } = useReportYears();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const logoMap = useLogoMap();
  const { data: profitabilityData = [] } = useProfitability();

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.closed_at), [accounts]);
  const accountId = accountValue !== '' ? Number(accountValue) : undefined;
  const { data: report, isLoading } = useReport(year, accountId);

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

  const stockGains = useMemo(() => {
    const investment = profitabilityData.filter((p) => p.envelope_type === 'investment');
    const filtered =
      accountId != null ? investment.filter((p) => p.account_id === accountId) : investment;
    return filtered.flatMap((p) => {
      const yr = p.yearly_returns.find((r) => r.year === String(year));
      if (!yr) return [];
      return [{ account_id: p.account_id, account_name: p.account_name, ...yr }];
    });
  }, [profitabilityData, year, accountId]);

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
            onChange={(e) => setYear(Number(e.target.value))}
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

          {/* Revenus vs Dépenses par mois */}
          {barData.some((d) => d.Revenus > 0 || d.Depenses > 0) ? (
            <>
              <SectionLabel label={t('section_monthly')} />
              <Card>
                <div className="flex gap-4 mb-3">
                  {(
                    [
                      [INCOME_COLOR, t('chart_income')],
                      [EXPENSE_COLOR, t('chart_expenses')],
                    ] as [string, string][]
                  ).map(([color, label]) => (
                    <div
                      key={label}
                      className="flex items-center gap-1.5 text-[11px] text-content-subtle"
                    >
                      <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
                      {label}
                    </div>
                  ))}
                </div>
                <Suspense fallback={<Skeleton className="h-44" />}>
                  <IncomeExpenseBarChart
                    data={barData}
                    incomeLabel={t('chart_income')}
                    expenseLabel={t('chart_expenses')}
                    incomeColor={INCOME_COLOR}
                    expenseColor={EXPENSE_COLOR}
                  />
                </Suspense>
              </Card>
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
                      <th className="font-medium pb-2 text-right">{t('stock_gain')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockGains.map((g) => {
                      const gainPos = g.gain >= 0;
                      return (
                        <tr
                          key={g.account_id}
                          className="border-b border-line-subtle last:border-0"
                        >
                          <td className="py-2 text-content-secondary">
                            {g.account_name}
                            {g.is_ytd && (
                              <span className="ml-1.5 text-[10px] text-content-faint">YTD</span>
                            )}
                          </td>
                          <td className="py-2 text-right tabular-nums text-content-muted">
                            {fmt(g.start_value)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-content-muted">
                            {fmt(g.end_value)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-content-muted">
                            {fmt(g.net_flows)}
                          </td>
                          <td
                            className={`py-2 text-right tabular-nums font-medium ${gainPos ? 'text-success' : 'text-danger'}`}
                          >
                            {gainPos ? '+' : ''}
                            {fmt(g.gain)}
                            {g.return_pct !== null && (
                              <span className="ml-1 text-[10px] font-normal text-content-muted">
                                ({gainPos ? '+' : ''}
                                {g.return_pct.toFixed(1)} %)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
