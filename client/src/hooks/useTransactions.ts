import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { transactionsApi, transfersApi } from '@/api/client';
import type { PaginatedTransactions, TransactionFilters } from '@/types';

type UpdatePayload = { id: number; account_id: number; type: 'income' | 'expense'; amount: number; description: string; category_id: number; date: string; payment_method_id: number; notes: string | null; validated: boolean };

export function useTransactions(filters?: TransactionFilters) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => transactionsApi.list(filters),
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transactionsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdatePayload) => transactionsApi.update(id, data),
    onSuccess: (updated) => {
      qc.setQueriesData<PaginatedTransactions>({ queryKey: ['transactions'] }, old =>
        old ? {
          ...old,
          data: old.data.map(tx => {
            if (tx.id === updated.id) return updated;
            if (updated.transfer_peer_id && tx.id === updated.transfer_peer_id)
              return { ...tx, amount: updated.amount, description: updated.description, date: updated.date };
            return tx;
          }),
        } : old
      );
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transactionsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useValidateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, validated }: { id: number; validated: boolean }) =>
      transactionsApi.validate(id, validated),
    onSuccess: (updated) => {
      qc.setQueriesData<PaginatedTransactions>({ queryKey: ['transactions'] }, old =>
        old ? { ...old, data: old.data.map(tx => tx.id === updated.id ? updated : tx) } : old
      );
    },
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transfersApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
