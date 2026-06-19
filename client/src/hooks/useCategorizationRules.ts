import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { categorizationRulesApi } from '@/api/client';
import { queryKeys } from '@/lib/queryKeys';

export function useCategorizationRules() {
  return useQuery({
    queryKey: queryKeys.categorizationRules.list(),
    queryFn: categorizationRulesApi.list,
  });
}

export function useMatchCategorizationRule(description: string) {
  return useQuery({
    queryKey: queryKeys.categorizationRules.match(description),
    queryFn: () => categorizationRulesApi.match(description),
    enabled: description.trim().length >= 2,
    staleTime: 30_000,
  });
}

export function useCreateCategorizationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pattern, subcategoryId }: { pattern: string; subcategoryId: number }) =>
      categorizationRulesApi.create(pattern, subcategoryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categorizationRules.list() }),
  });
}

export function useUpdateCategorizationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      pattern,
      subcategoryId,
    }: {
      id: number;
      pattern: string;
      subcategoryId: number;
    }) => categorizationRulesApi.update(id, pattern, subcategoryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categorizationRules.list() }),
  });
}

export function useDeleteCategorizationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => categorizationRulesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categorizationRules.list() }),
  });
}

export function useDeleteAllCategorizationRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: categorizationRulesApi.removeAll,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categorizationRules.list() }),
  });
}

export function useInitCategorizationRulesFromHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: categorizationRulesApi.initFromHistory,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categorizationRules.list() }),
  });
}
