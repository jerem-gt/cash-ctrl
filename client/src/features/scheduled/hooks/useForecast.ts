import { useQuery } from '@tanstack/react-query';

import { statsApi } from '@/api/client';
import { queryKeys } from '@/lib/queryKeys';

export function useForecast(horizon: 30 | 90) {
  return useQuery({
    queryKey: queryKeys.forecast(horizon),
    queryFn: () => statsApi.forecast(horizon),
    staleTime: 60_000,
  });
}
