import { Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardTitle, Empty, Metric, Skeleton } from '@/components/ui';
import { DashboardNav } from '@/features/dashboard/components/DashboardNav';
import { DashboardSkeleton } from '@/features/dashboard/components/DashboardSkeleton';
import { ProfitabilityTable } from '@/features/dashboard/components/ProfitabilityTable';
import { ReimbursementsCard } from '@/features/dashboard/components/ReimbursementsCard';
import { WealthCard } from '@/features/dashboard/components/WealthCard';
import { useDashboardData } from '@/features/dashboard/hooks/useDashboardData';
import { TxItem } from '@/features/transactions/components/TxItem';
import { fmt } from '@/lib/format';

const ExpensesPieChart = lazy(() => import('@/components/charts/ExpensesPieChart'));
const IncomeExpenseBarChart = lazy(() => import('@/components/charts/IncomeExpenseBarChart'));

const INCOME_COLOR = '#7DBB4A';
const EXPENSE_COLOR = '#D46060';
const NOW = Date.now();

function SectionLabel({ label, id }: Readonly<{ label: string; id?: string }>) {
  return (
    <div id={id} className="flex items-center gap-3 mt-2">
      <span className="text-[10px] font-medium uppercase tracking-widest text-content-faint whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-line-subtle" />
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const {
    isLoading,
    accounts,
    logoMap,
    colorMap,
    totalBalance,
    monthIncome,
    monthExpense,
    bilan,
    incomeTrend,
    expenseTrend,
    bilanTrend,
    catData,
    barData,
    recent,
    toValidate,
    upcoming,
    pendingReimbursements,
    recentReimbursements,
    balanceHistory,
    profitabilityList,
    hasReimbursements,
  } = useDashboardData();

  if (isLoading) return <DashboardSkeleton />;

  const trendLabel = t('metric_trend_vs_last_month');
  const txItemProps = { accounts, logoMap };

  const hasPendingSection = toValidate.length > 0 || upcoming.length > 0 || hasReimbursements;
  const hasWealthSection =
    (balanceHistory && balanceHistory.data.length > 0) || profitabilityList.length > 0;

  const pendingCount = toValidate.length + upcoming.length + pendingReimbursements.length;

  const navSections = [
    { id: 'section-this-month', label: t('section_this_month'), show: true },
    {
      id: 'section-pending',
      label: t('section_pending'),
      badge: pendingCount,
      show: hasPendingSection,
    },
    { id: 'section-wealth', label: t('section_wealth'), show: !!hasWealthSection },
    { id: 'section-recent', label: t('section_recent'), show: recent.length > 0 },
  ];

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div>
        <h2 className="font-display text-2xl tracking-tight">{t('title')}</h2>
        <p className="text-sm text-content-subtle mt-0.5">{t('subtitle')}</p>
      </div>

      <DashboardNav sections={navSections} />

      {/* ── Ce mois-ci ── */}
      <SectionLabel id="section-this-month" label={t('section_this_month')} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric
          label={t('metric_total_balance')}
          value={fmt(totalBalance)}
          sub={t('metric_accounts', { count: accounts.length })}
          icon={<Wallet size={15} />}
        />
        <Metric
          label={t('metric_income')}
          value={fmt(monthIncome)}
          variant="positive"
          icon={<TrendingUp size={15} />}
          trend={incomeTrend}
          trendLabel={trendLabel}
        />
        <Metric
          label={t('metric_expense')}
          value={fmt(monthExpense)}
          variant="negative"
          icon={<TrendingDown size={15} />}
          trend={expenseTrend}
          trendLabel={trendLabel}
        />
        <Metric
          label={t('metric_monthly')}
          value={fmt(bilan)}
          variant={bilan >= 0 ? 'positive' : 'negative'}
          icon={<Scale size={15} />}
          trend={bilanTrend}
          trendLabel={trendLabel}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
        <Card className="md:col-span-2">
          <CardTitle>{t('chart_expenses_by_cat')}</CardTitle>
          {catData.length === 0 ? (
            <Empty>{t('chart_no_expenses')}</Empty>
          ) : (
            <>
              <Suspense fallback={<Skeleton className="h-44" />}>
                <ExpensesPieChart data={catData} />
              </Suspense>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
                {catData.map((d) => (
                  <div
                    key={d.name}
                    className="flex items-center gap-1.5 text-[11px] text-content-muted"
                  >
                    <div
                      className="w-2 h-2 rounded-sm shrink-0"
                      style={{ background: colorMap[d.name] }}
                    />
                    {d.name} <strong className="text-content-secondary">{fmt(d.value)}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card className="md:col-span-3">
          <CardTitle>{t('chart_income_vs_expenses')}</CardTitle>
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
      </div>

      {/* ── À traiter ── */}
      {hasPendingSection && (
        <>
          <SectionLabel id="section-pending" label={t('section_pending')} />

          {(toValidate.length > 0 || upcoming.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {toValidate.length > 0 && (
                <Card>
                  <CardTitle>{t('to_validate')}</CardTitle>
                  <div className="flex flex-col gap-2 mt-1">
                    {toValidate.map((tx) => (
                      <TxItem key={tx.id} tx={tx} {...txItemProps} />
                    ))}
                  </div>
                </Card>
              )}
              {upcoming.length > 0 && (
                <Card>
                  <CardTitle>{t('upcoming')}</CardTitle>
                  <div className="flex flex-col gap-2 mt-1">
                    {upcoming.map((tx) => (
                      <TxItem key={tx.id} tx={tx} {...txItemProps} />
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {hasReimbursements && (
            <ReimbursementsCard pending={pendingReimbursements} recent={recentReimbursements} />
          )}
        </>
      )}

      {/* ── Patrimoine ── */}
      {hasWealthSection && (
        <>
          <SectionLabel id="section-wealth" label={t('section_wealth')} />

          {balanceHistory && balanceHistory.data.length > 0 && (
            <WealthCard history={balanceHistory} />
          )}

          {profitabilityList.length > 0 && (
            <ProfitabilityTable list={profitabilityList} now={NOW} />
          )}
        </>
      )}

      {/* ── Récent ── */}
      {recent.length > 0 && (
        <>
          <SectionLabel id="section-recent" label={t('section_recent')} />

          <Card>
            <CardTitle>{t('recent_transactions')}</CardTitle>
            <div className="flex flex-col gap-2 mt-1">
              {recent.map((tx) => (
                <TxItem key={tx.id} tx={tx} {...txItemProps} />
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
