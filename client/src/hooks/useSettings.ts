import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { settingsApi } from '@/api/client';
import type { SystemRefsPayload } from '@/types';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.update,
    onSuccess: (data) => {
      qc.setQueryData(['settings'], data);
    },
  });
}

export function useUpdateSystemRefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SystemRefsPayload) => settingsApi.updateSystemRefs(payload),
    onSuccess: (data) => {
      qc.setQueryData(['settings'], data);
    },
  });
}
