import { useQuery } from '@tanstack/react-query';

import { taxApi } from '@/api/client';

export function useTaxYears() {
  return useQuery({
    queryKey: ['tax', 'years'],
    queryFn: taxApi.years,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useTaxYearData(year: number | undefined) {
  return useQuery({
    queryKey: ['tax', 'year', year],
    queryFn: () => taxApi.yearData(year!),
    enabled: year != null,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
