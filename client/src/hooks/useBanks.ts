import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { banksApi } from '@/api/client';
import { queryKeys } from '@/lib/queryKeys';

export function useBanks() {
  return useQuery({ queryKey: queryKeys.banks(), queryFn: banksApi.list });
}

export function useCreateBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: banksApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.banks() }),
  });
}

export function useUpdateBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number; name: string; domain?: string | null }) =>
      banksApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.banks() }),
  });
}

export function useUploadBankLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => banksApi.uploadLogo(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.banks() }),
  });
}

export function useReorderBanks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: banksApi.reorder,
    onError: () => qc.invalidateQueries({ queryKey: queryKeys.banks() }),
  });
}

export function useDeleteBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: banksApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.banks() }),
  });
}
