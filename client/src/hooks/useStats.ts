import { useQuery } from '@tanstack/react-query';

import { statsApi } from '@/api/client';
import { queryKeys } from '@/lib/queryKeys';

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboardStats(),
    queryFn: statsApi.dashboard,
    staleTime: 30_000,
  });
}

export function useBalanceHistory() {
  return useQuery({
    queryKey: queryKeys.balanceHistory(),
    queryFn: statsApi.balanceHistory,
    staleTime: 5 * 60_000,
  });
}

export function useProfitability() {
  return useQuery({
    queryKey: queryKeys.profitability(),
    queryFn: statsApi.profitability,
    staleTime: 60_000,
  });
}

export function useAccountBalanceHistory(accountId: number, days: 30 | 90 | 365) {
  return useQuery({
    queryKey: queryKeys.accountBalanceHistory(accountId, days),
    queryFn: () => statsApi.accountBalanceHistory(accountId, days),
    staleTime: 60_000,
  });
}
