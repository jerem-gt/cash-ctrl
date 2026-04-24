import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { scheduledApi, type ScheduledPayload } from '@/api/client';

export function useScheduled() {
  return useQuery({
    queryKey: ['scheduled'],
    queryFn: scheduledApi.list,
  });
}

export function useCreateScheduled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: scheduledApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useUpdateScheduled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & ScheduledPayload) => scheduledApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useDeleteScheduled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: scheduledApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
