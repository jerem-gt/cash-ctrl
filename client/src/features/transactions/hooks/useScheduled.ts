import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { scheduledApi, type ScheduledPayload } from '@/api/client';
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
      void qc.invalidateQueries({ queryKey: queryKeys.scheduled() });
      void qc.invalidateQueries({ queryKey: queryKeys.transactions.all() });
    },
  });
}

export function useUpdateScheduled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & ScheduledPayload) =>
      scheduledApi.update(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.scheduled() });
      void qc.invalidateQueries({ queryKey: queryKeys.transactions.all() });
    },
  });
}

export function useDeleteScheduled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: scheduledApi.remove,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.scheduled() });
      void qc.invalidateQueries({ queryKey: queryKeys.transactions.all() });
    },
  });
}
