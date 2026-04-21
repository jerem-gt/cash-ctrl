import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountTypesApi } from '@/api/client';

export function useAccountTypes() {
  return useQuery({ queryKey: ['account-types'], queryFn: accountTypesApi.list });
}

export function useCreateAccountType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountTypesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-types'] }),
  });
}

export function useUpdateAccountType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number; name: string }) => accountTypesApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-types'] }),
  });
}

export function useDeleteAccountType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountTypesApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-types'] }),
  });
}
