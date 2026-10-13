import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { accountsApi } from '@/api/client';
import { invalidateBalances, invalidateTransactions } from '@/lib/invalidate';
import { queryKeys } from '@/lib/queryKeys';

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts(),
    queryFn: accountsApi.list,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountsApi.create,
    onSuccess: () => invalidateBalances(qc),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: number;
      name: string;
      bank_id: number | null;
      account_type_id: number | null;
      initial_balance: number;
      opening_date: string | null;
    }) => accountsApi.update(id, payload),
    onSuccess: () => invalidateBalances(qc),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountsApi.remove,
    onSuccess: () => {
      invalidateBalances(qc);
      invalidateTransactions(qc);
    },
  });
}

export function useReopenAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountsApi.reopen,
    onSuccess: () => invalidateBalances(qc),
  });
}

export function useCloseAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: number;
      closed_at: string;
      transfer_to_account_id?: number;
    }) => accountsApi.close(id, payload),
    onSuccess: () => {
      invalidateBalances(qc);
      invalidateTransactions(qc);
    },
  });
}
