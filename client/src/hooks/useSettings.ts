import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { settingsApi } from '@/api/client';

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
