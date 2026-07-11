import type { ScheduledPayload } from '@cashctrl/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { scheduledApi } from '@/api/client';
import { fireAndForget } from '@/lib/async';
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
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.transactions.all() }));
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.forecastAll() }));
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.accountBalanceHistoryAll() }));
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
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.transactions.all() }));
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.forecastAll() }));
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.accountBalanceHistoryAll() }));
    },
  });
}

export function useDeleteScheduled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: scheduledApi.remove,
    onSuccess: () => {
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.scheduled() }));
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.transactions.all() }));
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.forecastAll() }));
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.accountBalanceHistoryAll() }));
    },
  });
}
