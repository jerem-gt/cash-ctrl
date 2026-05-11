import { useQuery } from '@tanstack/react-query';

import { statsApi } from '@/api/client';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: statsApi.dashboard,
    staleTime: 30_000,
  });
}

export function useBalanceHistory() {
  return useQuery({
    queryKey: ['balance-history'],
    queryFn: statsApi.balanceHistory,
    staleTime: 5 * 60_000,
  });
}
