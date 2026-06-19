import type { PaginatedTransactions, TransactionFilters, TransactionSplit } from '@cashctrl/types';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { transactionsApi, transfersApi } from '@/api/client';
import { queryKeys } from '@/lib/queryKeys';

type UpdatePayload = {
  id: number;
  account_id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  subcategory_id: number | null;
  splits?: Pick<TransactionSplit, 'subcategory_id' | 'amount'>[];
  date: string;
  payment_method_id: number;
  notes: string | null;
  validated: boolean;
  scheduled_id?: number | null;
};

type UpdateTransferPayload = {
  id: number;
  amount: number;
  description: string;
  date: string;
  validated: boolean;
  from_account_id?: number;
  to_account_id?: number;
};

export function useTransactions(filters?: TransactionFilters) {
  return useQuery({
    queryKey: queryKeys.transactions.list(filters),
    queryFn: () => transactionsApi.list(filters),
    // Garde l'ancienne page affichée pendant le chargement de la suivante
    // (pagination/filtres fluides, sans flash de spinner).
    placeholderData: keepPreviousData,
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transactionsApi.create,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.transactions.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.accounts() });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboardStats() });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdatePayload) => transactionsApi.update(id, data),
    onSuccess: (updated) => {
      qc.setQueriesData<PaginatedTransactions>({ queryKey: queryKeys.transactions.all() }, (old) =>
        old ? { ...old, data: old.data.map((tx) => (tx.id === updated.id ? updated : tx)) } : old,
      );
      void qc.invalidateQueries({ queryKey: queryKeys.accounts() });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboardStats() });
    },
  });
}

export function useUpdateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateTransferPayload) => transfersApi.update(id, data),
    onSuccess: (updated) => {
      qc.setQueriesData<PaginatedTransactions>({ queryKey: queryKeys.transactions.all() }, (old) =>
        old
          ? {
              ...old,
              data: old.data.map((tx) => {
                if (tx.id === updated.id) return updated;
                if (updated.transfer_peer_id && tx.id === updated.transfer_peer_id)
                  return {
                    ...tx,
                    amount: updated.amount,
                    description: updated.description,
                    date: updated.date,
                    validated: updated.validated,
                  };
                return tx;
              }),
            }
          : old,
      );
      void qc.invalidateQueries({ queryKey: queryKeys.accounts() });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transactionsApi.remove,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.transactions.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.accounts() });
      void qc.invalidateQueries({ queryKey: queryKeys.stockPositions.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboardStats() });
    },
  });
}

export function useDeleteTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transfersApi.remove,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.transactions.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.accounts() });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboardStats() });
    },
  });
}

export function useValidateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, validated }: { id: number; validated: boolean }) =>
      transactionsApi.validate(id, validated),
    onSuccess: (updated) => {
      qc.setQueriesData<PaginatedTransactions>({ queryKey: queryKeys.transactions.all() }, (old) =>
        old ? { ...old, data: old.data.map((tx) => (tx.id === updated.id ? updated : tx)) } : old,
      );
      void qc.invalidateQueries({ queryKey: queryKeys.accounts() });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboardStats() });
    },
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transfersApi.create,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.transactions.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.accounts() });
    },
  });
}
