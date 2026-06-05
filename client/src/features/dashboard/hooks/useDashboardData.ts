import { useMemo } from 'react';

import { deltaTrend, pctTrend } from '@/features/dashboard/lib/trends';
import {
  usePendingReimbursements,
  useRecentReimbursements,
} from '@/features/transactions/hooks/useReimbursements';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useLogoMap } from '@/hooks/useLogoMap';
import { useBalanceHistory, useDashboardStats, useProfitability } from '@/hooks/useStats';
import { accountDisplayBalance } from '@/lib/account';
import { generateColor } from '@/lib/colors';
import { monthLabel } from '@/lib/format';

export function useDashboardData() {
  const { data: accounts = [] } = useAccounts();
  const { data: stats, isLoading } = useDashboardStats();
  const { data: balanceHistory } = useBalanceHistory();
  const { data: profitabilityList = [] } = useProfitability();
  const { data: categories = [] } = useCategories();
  const { data: pendingReimbursements = [] } = usePendingReimbursements();
  const { data: recentReimbursements = [] } = useRecentReimbursements();
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
  const prevMonth = monthly.length >= 2 ? monthly.at(-2) : undefined;
  const incomeTrend = prevMonth ? pctTrend(monthIncome, prevMonth.income, true) : undefined;
  const expenseTrend = prevMonth ? pctTrend(monthExpense, prevMonth.expense, false) : undefined;
  const bilanTrend = prevMonth
    ? deltaTrend(bilan, prevMonth.income - prevMonth.expense)
    : undefined;

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

  return {
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
    recent: stats?.recent ?? [],
    toValidate: stats?.to_validate ?? [],
    upcoming: stats?.upcoming ?? [],
    pendingReimbursements,
    recentReimbursements,
    balanceHistory,
    profitabilityList,
    hasReimbursements: pendingReimbursements.length > 0 || recentReimbursements.length > 0,
  };
}
