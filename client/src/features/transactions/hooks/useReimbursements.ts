import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { reimbursementsApi } from '@/api/client';
import { queryKeys } from '@/lib/queryKeys';

export function usePendingReimbursements() {
  return useQuery({
    queryKey: queryKeys.reimbursementsPending(),
    queryFn: reimbursementsApi.pending,
  });
}

export function useRecentReimbursements() {
  return useQuery({
    queryKey: queryKeys.reimbursementsRecent(),
    queryFn: reimbursementsApi.recent,
  });
}

export function useReimbursements(transactionId: number) {
  return useQuery({
    queryKey: queryKeys.reimbursements(transactionId),
    queryFn: () => reimbursementsApi.list(transactionId),
    enabled: transactionId > 0,
  });
}

export function useLinkReimbursement(transactionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      linkedTxId,
      attributedAmount,
    }: {
      linkedTxId: number;
      attributedAmount?: number;
    }) => reimbursementsApi.link(transactionId, linkedTxId, attributedAmount),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.reimbursements(transactionId) });
      void qc.invalidateQueries({ queryKey: queryKeys.reimbursementsPending() });
      void qc.invalidateQueries({ queryKey: queryKeys.transactions.all() });
    },
  });
}

export function useUpdateReimbursementAmount(transactionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ linkedId, amount }: { linkedId: number; amount: number | null }) =>
      reimbursementsApi.updateAmount(transactionId, linkedId, amount),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.reimbursements(transactionId) });
      void qc.invalidateQueries({ queryKey: queryKeys.reimbursementsPending() });
    },
  });
}

export function useUnlinkReimbursement(transactionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkedId: number) => reimbursementsApi.unlink(transactionId, linkedId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.reimbursements(transactionId) });
      void qc.invalidateQueries({ queryKey: queryKeys.reimbursementsPending() });
      void qc.invalidateQueries({ queryKey: queryKeys.transactions.all() });
    },
  });
}

export function useSetReimbursementStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'en_attente' | 'rembourse' | null }) =>
      reimbursementsApi.setStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.transactions.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.reimbursementsPending() });
      void qc.invalidateQueries({ queryKey: queryKeys.reimbursementsRecent() });
    },
  });
}
