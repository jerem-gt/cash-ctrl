import { useQuery } from '@tanstack/react-query';

import { statsApi } from '@/api/client';
import { queryKeys } from '@/lib/queryKeys';

export function useForecast(horizon: 30 | 90, accountId?: number) {
  return useQuery({
    queryKey: queryKeys.forecast(horizon, accountId),
    queryFn: () => statsApi.forecast(horizon, accountId),
    staleTime: 60_000,
  });
}
