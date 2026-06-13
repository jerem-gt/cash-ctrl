import { useQuery } from '@tanstack/react-query';

import { taxApi } from '@/api/client';
import { queryKeys } from '@/lib/queryKeys';

export function useTaxYears() {
  return useQuery({
    queryKey: queryKeys.taxYears(),
    queryFn: taxApi.years,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useTaxYearData(year: number | undefined) {
  return useQuery({
    queryKey: queryKeys.taxYear(year),
    queryFn: () => taxApi.yearData(year!),
    enabled: year != null,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
