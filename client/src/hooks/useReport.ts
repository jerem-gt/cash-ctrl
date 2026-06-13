import { useQuery } from '@tanstack/react-query';

import { statsApi } from '@/api/client';
import { queryKeys } from '@/lib/queryKeys';

export function useReportYears() {
  return useQuery({
    queryKey: queryKeys.reportYears(),
    queryFn: statsApi.reportYears,
    staleTime: 5 * 60_000,
  });
}

export function useReport(year: number, accountId?: number) {
  return useQuery({
    queryKey: queryKeys.report(year, accountId),
    queryFn: () => statsApi.report({ year, account_id: accountId }),
    staleTime: 60_000,
  });
}
