import type {
  PaginatedTransactions,
  Transaction,
  TransactionFilters,
  UpdateTransactionPayload,
  UpdateTransferPayload,
} from '@cashctrl/types';
import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { transactionsApi, transfersApi } from '@/api/client';
import { fireAndForget } from '@/lib/async';
import { invalidateBalances, invalidatePortfolio, invalidateTransactions } from '@/lib/invalidate';
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

const FILTERABLE_FIELDS = [
  'account_id',
  'type',
  'amount',
  'description',
  'date',
  'category_id',
  'subcategory_id',
  'payment_method_id',
  'validated',
  'scheduled_id',
] as const satisfies readonly (keyof Transaction)[];

function hasActiveFilter(filters?: TransactionFilters) {
  if (!filters) return false;
  return Object.entries(filters).some(
    ([name, value]) => name !== 'page' && name !== 'limit' && value !== undefined,
  );
}

function matchesFilterableFields(a: Transaction, b: Transaction) {
  return FILTERABLE_FIELDS.every((field) => a[field] === b[field]);
}

/**
 * Patche les listes en cache après modification. Invalide plutôt que de patcher
 * quand la page ne contient pas la ligne (balance_before_page non recalculable)
 * ou qu'un champ filtrable change dans une liste filtrée (la ligne peut en sortir).
 * `peerPatch` met à jour la jambe pair d'un virement.
 */
function patchTransactionLists(
  qc: QueryClient,
  updated: Transaction,
  peerPatch?: Partial<Transaction>,
) {
  const peerId = peerPatch ? updated.transfer_peer_id : null;
  const entries = qc.getQueriesData<PaginatedTransactions>({
    queryKey: queryKeys.transactions.all(),
  });
  for (const [key, old] of entries) {
    if (!old) continue;
    const filters = key[1] as TransactionFilters | undefined;
    const previous = old.data.find((tx) => tx.id === updated.id);
    if (filters?.page !== undefined && !previous) {
      fireAndForget(qc.invalidateQueries({ queryKey: key }));
      continue;
    }
    if (previous && hasActiveFilter(filters) && !matchesFilterableFields(previous, updated)) {
      fireAndForget(qc.invalidateQueries({ queryKey: key }));
      continue;
    }
    const patched = old.data.map((tx) => {
      if (tx.id === updated.id) return updated;
      if (peerId !== null && tx.id === peerId) return { ...tx, ...peerPatch };
      return tx;
    });
    qc.setQueryData<PaginatedTransactions>(key, {
      ...old,
      data: patched.toSorted(byDateThenIdDesc),
    });
  }
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transactionsApi.create,
    onSuccess: () => {
      invalidateTransactions(qc);
      invalidateBalances(qc);
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdatePayload) => transactionsApi.update(id, data),
    onSuccess: (updated) => {
      patchTransactionLists(qc, updated);
      invalidateBalances(qc);
    },
  });
}

export function useUpdateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateTransferPayloadWithId) => transfersApi.update(id, data),
    onSuccess: (updated) => {
      patchTransactionLists(qc, updated, {
        amount: updated.amount,
        description: updated.description,
        date: updated.date,
        validated: updated.validated,
      });
      invalidateBalances(qc);
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transactionsApi.remove,
    onSuccess: () => {
      invalidateTransactions(qc);
      invalidatePortfolio(qc);
      invalidateBalances(qc);
    },
  });
}

export function useDeleteTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transfersApi.remove,
    onSuccess: () => {
      invalidateTransactions(qc);
      invalidateBalances(qc);
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
          fireAndForget(qc.invalidateQueries({ queryKey: key }));
        } else {
          qc.setQueryData<PaginatedTransactions>(key, (old) =>
            old
              ? { ...old, data: old.data.map((tx) => (tx.id === updated.id ? updated : tx)) }
              : old,
          );
        }
      }
      invalidateBalances(qc);
    },
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transfersApi.create,
    onSuccess: () => {
      invalidateTransactions(qc);
      invalidateBalances(qc);
    },
  });
}
