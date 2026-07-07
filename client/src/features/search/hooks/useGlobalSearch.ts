import { useQuery } from '@tanstack/react-query';

import { searchApi } from '@/api/client';
import { queryKeys } from '@/lib/queryKeys';

export function useGlobalSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: queryKeys.search(query),
    queryFn: () => searchApi.search(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}
