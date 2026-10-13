import type { ScheduledPayload } from '@cashctrl/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { scheduledApi } from '@/api/client';
import { fireAndForget } from '@/lib/async';
import { invalidateBalances, invalidateTransactions } from '@/lib/invalidate';
import { queryKeys } from '@/lib/queryKeys';

export function useScheduled() {
  return useQuery({
    queryKey: queryKeys.scheduled(),
    queryFn: scheduledApi.list,
  });
}

export function useCreateScheduled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: scheduledApi.create,
    onSuccess: () => {
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.scheduled() }));
      invalidateTransactions(qc);
      invalidateBalances(qc);
    },
  });
}

export function useUpdateScheduled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & ScheduledPayload) =>
      scheduledApi.update(id, data),
    onSuccess: () => {
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.scheduled() }));
      invalidateTransactions(qc);
      invalidateBalances(qc);
    },
  });
}

export function useDeleteScheduled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: scheduledApi.remove,
    onSuccess: () => {
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.scheduled() }));
      invalidateTransactions(qc);
      invalidateBalances(qc);
    },
  });
}
