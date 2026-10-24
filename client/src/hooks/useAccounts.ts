import type { Account } from '@cashctrl/types';
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

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, favorite }: { id: number; favorite: boolean }) =>
      accountsApi.setFavorite(id, favorite),
    onMutate: async ({ id, favorite }) => {
      await qc.cancelQueries({ queryKey: queryKeys.accounts() });
      const previous = qc.getQueryData<Account[]>(queryKeys.accounts());
      if (previous) {
        const nextOrder = Math.max(-1, ...previous.map((a) => a.favorite_order ?? -1)) + 1;
        qc.setQueryData<Account[]>(
          queryKeys.accounts(),
          previous.map((a) => {
            if (a.id !== id) return a;
            if (!favorite) return { ...a, favorite_order: null };
            return { ...a, favorite_order: a.favorite_order ?? nextOrder };
          }),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKeys.accounts(), context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.accounts() }),
  });
}

export function useReorderFavorites() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountsApi.reorderFavorites,
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: queryKeys.accounts() });
      const previous = qc.getQueryData<Account[]>(queryKeys.accounts());
      if (previous) {
        const orderById = new Map(items.map((i) => [i.id, i.favorite_order]));
        qc.setQueryData<Account[]>(
          queryKeys.accounts(),
          previous.map((a) => {
            const order = orderById.get(a.id);
            return order === undefined ? a : { ...a, favorite_order: order };
          }),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKeys.accounts(), context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.accounts() }),
  });
}
