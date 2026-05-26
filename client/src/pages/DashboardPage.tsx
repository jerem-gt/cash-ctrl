import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  LabelList,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardTitle, Empty, Metric, Skeleton } from '@/components/ui';
import { TxItem } from '@/features/transactions/components/TxItem';
import {
  usePendingReimbursements,
  useRecentReimbursements,
  useSetReimbursementStatus,
} from '@/features/transactions/hooks/useReimbursements';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useLogoMap } from '@/hooks/useLogoMap';
import { useBalanceHistory, useDashboardStats, useProfitability } from '@/hooks/useStats';
import { accountDisplayBalance } from '@/lib/account';
import { generateColor } from '@/lib/colors.ts';
import { fmt, fmtDate, fmtDec, monthLabel } from '@/lib/format';

const NOW = Date.now();

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} size="sm">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-7 w-28" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
        <Card className="md:col-span-2">
          <Skeleton className="h-3 w-32 mb-4" />
          <Skeleton className="h-44" />
        </Card>
        <Card className="md:col-span-3">
          <Skeleton className="h-3 w-40 mb-4" />
          <Skeleton className="h-44" />
        </Card>
      </div>
      <Card>
        <Skeleton className="h-3 w-48 mb-4" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      </Card>
    </div>
  );
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
  const setReimbursementStatus = useSetReimbursementStatus();

  const txItemProps = { accounts, logoMap };

  if (statsLoading) return <DashboardSkeleton />;

  const balanceTypes = balanceHistory?.account_types ?? [];
  const balanceNegativeTypes = new Set(
    balanceTypes.filter((t) => (balanceHistory?.data ?? []).some((d) => Number(d[t] ?? 0) < 0)),
  );
  const balanceLastPositiveType = balanceTypes.findLast((t) => !balanceNegativeTypes.has(t));
  const balanceDataWithTotal = (balanceHistory?.data ?? []).map((d) => ({
    ...d,
    _total: balanceTypes.reduce((s, t) => s + Number(d[t] ?? 0), 0),
  }));
  const balanceHasLoans = (balanceHistory?.data ?? []).some((d) => Number(d['Prêts'] ?? 0) < 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-sans text-2xl tracking-tight">{t('title')}</h2>
        <p className="text-sm text-stone-400 mt-0.5">{t('subtitle')}</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric
          label={t('metric_total_balance')}
          value={fmt(totalBalance)}
          sub={t('metric_accounts', { count: accounts.length })}
        />
        <Metric label={t('metric_income')} value={fmt(monthIncome)} variant="positive" />
        <Metric label={t('metric_expense')} value={fmt(monthExpense)} variant="negative" />
        <Metric
          label={t('metric_monthly')}
          value={fmt(bilan)}
          variant={bilan >= 0 ? 'positive' : 'negative'}
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
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={catData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  />
                  <Tooltip formatter={(v) => (v == null ? '' : fmtDec(Number(v)))} />
                </PieChart>
              </ResponsiveContainer>
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
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} barGap={4}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => fmt(Number(v))}
                width={70}
              />
              <Tooltip formatter={(v) => (v == null ? '' : fmtDec(Number(v)))} />
              <Bar
                dataKey="Revenus"
                name={t('chart_income')}
                fill="#7DBB4A"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="Depenses"
                name={t('chart_expenses')}
                fill="#D46060"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
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

      {/* Remboursements */}
      {(pendingReimbursements.length > 0 || recentReimbursements.length > 0) && (
        <Card>
          <CardTitle>{t('reimbursements_title')}</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-120 text-xs">
              <thead>
                <tr className="text-stone-400 text-[10px] uppercase tracking-wider">
                  <th className="text-left pb-2 font-medium">{t('reimb_col_description')}</th>
                  <th className="text-left pb-2 font-medium hidden sm:table-cell">
                    {t('reimb_col_date')}
                  </th>
                  <th className="text-right pb-2 font-medium">{t('reimb_col_expense')}</th>
                  <th className="text-right pb-2 font-medium hidden sm:table-cell">
                    {t('reimb_col_reimbursed')}
                  </th>
                  <th className="text-right pb-2 font-medium">{t('reimb_col_remaining')}</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {pendingReimbursements.length > 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="pt-1 pb-1 text-[10px] font-medium uppercase tracking-widest text-amber-500"
                    >
                      {t('reimb_pending_section')}
                    </td>
                  </tr>
                )}
                {pendingReimbursements.map((item) => {
                  const remaining = item.amount - item.total_reimbursed;
                  return (
                    <tr key={item.id} className="group">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-stone-700 truncate max-w-40">
                          {item.description}
                        </p>
                        <p className="text-stone-400 text-[10px]">
                          {item.subcategory || item.category} · {item.account_name}
                        </p>
                      </td>
                      <td className="py-2 pr-3 text-stone-500 hidden sm:table-cell whitespace-nowrap">
                        {fmtDate(item.date)}
                      </td>
                      <td className="py-2 pr-3 text-right text-red-700 tabular-nums font-medium whitespace-nowrap">
                        −{fmtDec(item.amount)}
                      </td>
                      <td className="py-2 pr-3 text-right text-green-700 tabular-nums hidden sm:table-cell whitespace-nowrap">
                        {item.total_reimbursed > 0 ? `+${fmtDec(item.total_reimbursed)}` : '—'}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums font-medium whitespace-nowrap">
                        <span className={remaining > 0 ? 'text-red-700' : 'text-green-700'}>
                          {fmtDec(Math.max(0, remaining))}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setReimbursementStatus.mutate({ id: item.id, status: 'rembourse' })
                          }
                          disabled={setReimbursementStatus.isPending}
                          title={t('reimb_mark_done_title')}
                          className="text-stone-300 hover:text-green-500 transition-colors text-base leading-none opacity-0 group-hover:opacity-100"
                        >
                          ✓
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {recentReimbursements.length > 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="pt-4 pb-1 text-[10px] font-medium uppercase tracking-widest text-green-600"
                    >
                      {t('reimb_done_section')}
                    </td>
                  </tr>
                )}
                {recentReimbursements.map((item) => {
                  const remaining = item.amount - item.total_reimbursed;
                  return (
                    <tr key={item.id} className="opacity-60">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-stone-700 truncate max-w-40">
                          {item.description}
                        </p>
                        <p className="text-stone-400 text-[10px]">
                          {item.subcategory || item.category} · {item.account_name}
                        </p>
                      </td>
                      <td className="py-2 pr-3 text-stone-500 hidden sm:table-cell whitespace-nowrap">
                        {fmtDate(item.date)}
                      </td>
                      <td className="py-2 pr-3 text-right text-stone-500 tabular-nums whitespace-nowrap">
                        −{fmtDec(item.amount)}
                      </td>
                      <td className="py-2 pr-3 text-right text-green-700 tabular-nums hidden sm:table-cell whitespace-nowrap">
                        {item.total_reimbursed > 0 ? `+${fmtDec(item.total_reimbursed)}` : '—'}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums font-medium whitespace-nowrap">
                        <span className={remaining > 0 ? 'text-red-700' : 'text-green-700'}>
                          {fmtDec(Math.max(0, remaining))}
                        </span>
                      </td>
                      <td />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
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

      {/* Patrimoine par catégorie */}
      {balanceHistory && balanceHistory.data.length > 0 && (
        <Card>
          <CardTitle>{t('patrimony_title')}</CardTitle>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-3">
            {balanceTypes.map((type, i) => (
              <div key={type} className="flex items-center gap-1.5 text-[11px] text-stone-500">
                <div
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ background: generateColor(i) }}
                />
                {type}
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={balanceDataWithTotal}
              stackOffset="sign"
              barGap={2}
              margin={{ top: 18, right: 8, left: 0, bottom: 0 }}
            >
              <XAxis dataKey="year" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => fmt(Number(v))}
                width={70}
              />
              <Tooltip
                formatter={(v, name, entry) => {
                  if (name === '_total') return null;
                  const total = (entry.payload as Record<string, number>)._total;
                  const pct = total === 0 ? 0 : (Number(v) / total) * 100;
                  return [`${fmtDec(Number(v))} (${pct.toFixed(1)} %)`, String(name)];
                }}
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              />
              {balanceHasLoans && <ReferenceLine y={0} stroke="rgba(0,0,0,0.15)" strokeWidth={1} />}
              {balanceTypes.map((type, i) => {
                const isNeg = balanceNegativeTypes.has(type);
                const isTopPositive = type === balanceLastPositiveType;
                const radius = isNeg || isTopPositive ? [3, 3, 0, 0] : [0, 0, 0, 0];
                return (
                  <Bar
                    key={type}
                    dataKey={type}
                    stackId="a"
                    fill={generateColor(i)}
                    radius={radius as [number, number, number, number]}
                  >
                    {isTopPositive && (
                      <LabelList
                        dataKey="_total"
                        position="top"
                        formatter={(v: unknown) => fmt(Number(v ?? 0))}
                        style={{ fontSize: 10, fill: '#78716c' }}
                      />
                    )}
                  </Bar>
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Rendement de mes placements */}
      {profitabilityList.length > 0 && (
        <Card>
          <CardTitle>{t('profitability_title')}</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-stone-400 border-b border-stone-100">
                  <th className="text-left py-1.5 pr-4 font-normal">{t('prof_col_account')}</th>
                  <th className="text-right py-1.5 pr-4 font-normal">{t('prof_col_capital')}</th>
                  <th className="text-right py-1.5 pr-4 font-normal">{t('prof_col_value')}</th>
                  <th className="text-right py-1.5 pr-4 font-normal">{t('prof_col_gain')}</th>
                  <th className="text-right py-1.5 pr-4 font-normal">{t('prof_col_annual')}</th>
                  <th className="text-right py-1.5 font-normal">{t('prof_col_seniority')}</th>
                </tr>
              </thead>
              <tbody>
                {profitabilityList.map((p) => {
                  const gainPos = p.plus_value_absolue >= 0;
                  const gainColor = gainPos ? 'text-emerald-600' : 'text-red-600';
                  let annualizedLabel: string;
                  if (p.rendement_annualise_pct === null) {
                    annualizedLabel = '—';
                  } else {
                    const sign = p.rendement_annualise_pct >= 0 ? '+' : '';
                    annualizedLabel = `${sign}${p.rendement_annualise_pct.toFixed(1)} %`;
                  }
                  const msPerMonth = 30.44 * 24 * 3600 * 1000;
                  const totalMonths = Math.floor(
                    (NOW - new Date(p.opening_date).getTime()) / msPerMonth,
                  );
                  const years = Math.floor(totalMonths / 12);
                  const months = totalMonths % 12;
                  let durationLabel: string;
                  if (years === 0) {
                    durationLabel = t('duration_months', { months });
                  } else if (months === 0) {
                    durationLabel =
                      years > 1
                        ? t('duration_years_plural', { years })
                        : t('duration_years', { years });
                  } else {
                    durationLabel =
                      years > 1
                        ? t('duration_years_months_plural', { years, months })
                        : t('duration_years_months', { years, months });
                  }
                  return (
                    <tr key={p.account_id} className="border-b border-stone-50 last:border-0">
                      <td className="py-1.5 pr-4 font-medium">{p.account_name}</td>
                      <td className="text-right py-1.5 pr-4 tabular-nums text-stone-500">
                        {fmt(p.capital_investi)}
                      </td>
                      <td className="text-right py-1.5 pr-4 tabular-nums">
                        {fmt(p.valeur_actuelle)}
                      </td>
                      <td className={`text-right py-1.5 pr-4 tabular-nums ${gainColor}`}>
                        {gainPos ? '+' : ''}
                        {fmt(p.plus_value_absolue)}
                      </td>
                      <td className={`text-right py-1.5 pr-4 tabular-nums ${gainColor}`}>
                        {annualizedLabel}
                      </td>
                      <td className="text-right py-1.5 tabular-nums text-stone-400">
                        {durationLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
