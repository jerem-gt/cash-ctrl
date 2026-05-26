import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { accountTypesApi } from '@/api/client';

export function useAccountTypes() {
  return useQuery({ queryKey: ['account-types'], queryFn: accountTypesApi.list });
}

export function useCreateAccountType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountTypesApi.create,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['account-types'] }),
  });
}

export function useUpdateAccountType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number; name: string; envelope_type: string | null }) =>
      accountTypesApi.update(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['account-types'] });
      void qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useDeleteAccountType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountTypesApi.remove,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['account-types'] }),
  });
}
