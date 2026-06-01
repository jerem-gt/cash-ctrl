import { Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { lazy, Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardTitle, Empty, Metric, Skeleton } from '@/components/ui';
import type { MetricTrend } from '@/components/ui/layout';
import { DashboardSkeleton } from '@/features/dashboard/components/DashboardSkeleton';
import { PatrimonyCard } from '@/features/dashboard/components/PatrimonyCard';
import { ProfitabilityTable } from '@/features/dashboard/components/ProfitabilityTable';
import { ReimbursementsCard } from '@/features/dashboard/components/ReimbursementsCard';
import { TxItem } from '@/features/transactions/components/TxItem';
import {
  usePendingReimbursements,
  useRecentReimbursements,
} from '@/features/transactions/hooks/useReimbursements';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useLogoMap } from '@/hooks/useLogoMap';
import { useBalanceHistory, useDashboardStats, useProfitability } from '@/hooks/useStats';
import { accountDisplayBalance } from '@/lib/account';
import { generateColor } from '@/lib/colors.ts';
import { fmt, monthLabel } from '@/lib/format';

// Graphiques recharts chargés à la demande : ils représentent l'essentiel du
// poids JS de la page mais ne sont pas nécessaires au premier rendu (KPI, listes).
const ExpensesPieChart = lazy(() => import('@/components/charts/ExpensesPieChart'));
const IncomeExpenseBarChart = lazy(() => import('@/components/charts/IncomeExpenseBarChart'));

const NOW = Date.now();

const FLAT_PCT: MetricTrend = { direction: 'flat', value: '0 %', positive: true };

// Variation en % du mois courant vs mois précédent. `higherIsBetter` détermine la
// couleur : pour les revenus une hausse est favorable, pour les dépenses non.
function pctTrend(current: number, prev: number, higherIsBetter: boolean): MetricTrend | undefined {
  if (prev === 0) {
    // Pas de base de comparaison : état neutre seulement si le mois courant est
    // lui aussi nul (stable à 0). Sinon le % n'aurait pas de sens.
    if (current === 0) return FLAT_PCT;
    return undefined;
  }
  const pct = ((current - prev) / Math.abs(prev)) * 100;
  const rounded = Math.round(pct);
  if (rounded === 0) return FLAT_PCT;
  return {
    direction: rounded > 0 ? 'up' : 'down',
    value: `${Math.abs(rounded)} %`,
    positive: pct > 0 === higherIsBetter,
  };
}

// Pour un solde net (bilan), un % serait trompeur si la base est négative : on
// compare en valeur absolue (écart en euros). Une hausse est toujours favorable.
function deltaTrend(current: number, prev: number): MetricTrend {
  const diff = current - prev;
  if (Math.round(diff) === 0) return { direction: 'flat', value: fmt(0), positive: true };
  return {
    direction: diff > 0 ? 'up' : 'down',
    value: fmt(Math.abs(diff)),
    positive: diff > 0,
  };
}

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { data: accounts = [] } = useAccounts();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: balanceHistory } = useBalanceHistory();
  const { data: profitabilityList = [] } = useProfitability();
  const { data: categories = [] } = useCategories();
  const logoMap = useLogoMap();

  const colorMap = useMemo(
    () => Object.fromEntries(categories.map((c, i) => [c.name, generateColor(i)])),
    [categories],
  );

  const totalBalance = accounts.reduce((s, a) => s + accountDisplayBalance(a), 0);
  const monthIncome = stats?.month_income ?? 0;
  const monthExpense = stats?.month_expense ?? 0;
  const bilan = monthIncome - monthExpense;

  // monthly[] est ordonné ancien→récent ; l'avant-dernier élément = mois précédent.
  const monthly = stats?.monthly ?? [];
  const prevMonth = monthly.length >= 2 ? monthly[monthly.length - 2] : undefined;
  const incomeTrend = prevMonth ? pctTrend(monthIncome, prevMonth.income, true) : undefined;
  const expenseTrend = prevMonth ? pctTrend(monthExpense, prevMonth.expense, false) : undefined;
  const bilanTrend = prevMonth
    ? deltaTrend(bilan, prevMonth.income - prevMonth.expense)
    : undefined;
  const trendLabel = t('metric_trend_vs_last_month');

  const catData = useMemo(
    () =>
      (stats?.expenses_by_category ?? []).map((d) => ({
        name: d.category,
        value: d.amount,
        fill: colorMap[d.category],
      })),
    [stats, colorMap],
  );

  const barData = useMemo(
    () =>
      (stats?.monthly ?? []).map((m, i) => ({
        month: monthLabel(5 - i),
        Revenus: m.income,
        Depenses: m.expense,
      })),
    [stats],
  );

  const recent = stats?.recent ?? [];
  const toValidate = stats?.to_validate ?? [];
  const upcoming = stats?.upcoming ?? [];

  const { data: pendingReimbursements = [] } = usePendingReimbursements();
  const { data: recentReimbursements = [] } = useRecentReimbursements();

  const txItemProps = { accounts, logoMap };

  if (statsLoading) return <DashboardSkeleton />;

  const hasReimbursements = pendingReimbursements.length > 0 || recentReimbursements.length > 0;
  const hasPatrimony = balanceHistory && balanceHistory.data.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl tracking-tight">{t('title')}</h2>
        <p className="text-sm text-stone-400 mt-0.5">{t('subtitle')}</p>
      </div>

      {/* Metrics */}
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

      {/* Charts */}
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
                    className="flex items-center gap-1.5 text-[11px] text-stone-500"
                  >
                    <div
                      className="w-2 h-2 rounded-sm shrink-0"
                      style={{ background: colorMap[d.name] }}
                    />
                    {d.name} <strong className="text-stone-700">{fmt(d.value)}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card className="md:col-span-3">
          <CardTitle>{t('chart_income_vs_expenses')}</CardTitle>
          <div className="flex gap-4 mb-3">
            {[
              ['#7DBB4A', t('chart_income')],
              ['#D46060', t('chart_expenses')],
            ].map(([color, label]) => (
              <div key={label} className="flex items-center gap-1.5 text-[11px] text-stone-400">
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
            />
          </Suspense>
        </Card>
      </div>

      {/* Transactions — À valider + À venir */}
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

      {/* Dernières transactions */}
      <Card>
        <CardTitle>{t('recent_transactions')}</CardTitle>
        {recent.length === 0 ? (
          <Empty>{t('no_transactions')}</Empty>
        ) : (
          <div className="flex flex-col gap-2 mt-1">
            {recent.map((tx) => (
              <TxItem key={tx.id} tx={tx} {...txItemProps} />
            ))}
          </div>
        )}
      </Card>

      {hasPatrimony && <PatrimonyCard history={balanceHistory} />}

      {profitabilityList.length > 0 && <ProfitabilityTable list={profitabilityList} now={NOW} />}
    </div>
  );
}
