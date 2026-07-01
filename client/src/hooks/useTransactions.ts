import type {
  PaginatedTransactions,
  TransactionFilters,
  UpdateTransactionPayload,
  UpdateTransferPayload,
} from '@cashctrl/types';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { transactionsApi, transfersApi } from '@/api/client';
import { queryKeys } from '@/lib/queryKeys';

type UpdatePayload = UpdateTransactionPayload & { id: number };
type UpdateTransferPayloadWithId = UpdateTransferPayload & { id: number };

// Même ordre que la requête serveur (ORDER BY t.date DESC, t.id DESC), pour que
// l'édition de la date d'une transaction remette immédiatement la liste en ordre.
function byDateThenIdDesc(a: { date: string; id: number }, b: { date: string; id: number }) {
  if (a.date !== b.date) return a.date > b.date ? -1 : 1;
  return b.id - a.id;
}

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
      // balance_before_page des autres pages non recalculable localement → invalidation.
      const entries = qc.getQueriesData<PaginatedTransactions>({
        queryKey: queryKeys.transactions.all(),
      });
      for (const [key, old] of entries) {
        if (!old) continue;
        const filters = key[1] as TransactionFilters | undefined;
        const containsUpdated = old.data.some((tx) => tx.id === updated.id);
        if (filters?.page !== undefined && !containsUpdated) {
          void qc.invalidateQueries({ queryKey: key });
          continue;
        }
        qc.setQueryData<PaginatedTransactions>(key, {
          ...old,
          data: old.data.map((tx) => (tx.id === updated.id ? updated : tx)).sort(byDateThenIdDesc),
        });
      }
      void qc.invalidateQueries({ queryKey: queryKeys.accounts() });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboardStats() });
    },
  });
}

export function useUpdateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateTransferPayloadWithId) => transfersApi.update(id, data),
    onSuccess: (updated) => {
      qc.setQueriesData<PaginatedTransactions>({ queryKey: queryKeys.transactions.all() }, (old) =>
        old
          ? {
              ...old,
              data: old.data
                .map((tx) => {
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
                })
                .sort(byDateThenIdDesc),
            }
          : old,
      );
      void qc.invalidateQueries({ queryKey: queryKeys.accounts() });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboardStats() });
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
      void qc.invalidateQueries({ queryKey: queryKeys.stocks.positions.all() });
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
      // Vue filtrée par validated devenue incohérente → invalidation (refetch,
      // total/pagination corrects) ; sinon patch en place comme avant.
      const entries = qc.getQueriesData<PaginatedTransactions>({
        queryKey: queryKeys.transactions.all(),
      });
      for (const [key] of entries) {
        const filters = key[1] as TransactionFilters | undefined;
        if (filters?.validated !== undefined && filters.validated !== !!updated.validated) {
          void qc.invalidateQueries({ queryKey: key });
        } else {
          qc.setQueryData<PaginatedTransactions>(key, (old) =>
            old
              ? { ...old, data: old.data.map((tx) => (tx.id === updated.id ? updated : tx)) }
              : old,
          );
        }
      }
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
      void qc.invalidateQueries({ queryKey: queryKeys.dashboardStats() });
    },
  });
}
