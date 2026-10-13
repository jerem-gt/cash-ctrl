import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { banksApi } from '@/api/client';
import { fireAndForget } from '@/lib/async';
import { queryKeys } from '@/lib/queryKeys';

// Le nom de banque est dénormalisé dans les comptes (useLogoMap l'indexe par nom).
function invalidateBankAndAccounts(qc: QueryClient) {
  fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.banks() }));
  fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.accounts() }));
}

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
    mutationFn: ({ id, ...payload }: { id: number; name: string; login_url?: string | null }) =>
      banksApi.update(id, payload),
    onSuccess: () => invalidateBankAndAccounts(qc),
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
    onSuccess: () => invalidateBankAndAccounts(qc),
  });
}
