import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { reimbursementsApi } from '@/api/client';

export function usePendingReimbursements() {
  return useQuery({
    queryKey: ['reimbursements', 'pending'],
    queryFn: reimbursementsApi.pending,
  });
}

export function useReimbursements(transactionId: number) {
  return useQuery({
    queryKey: ['reimbursements', transactionId],
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
      qc.invalidateQueries({ queryKey: ['reimbursements', transactionId] });
      qc.invalidateQueries({ queryKey: ['reimbursements', 'pending'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useUpdateReimbursementAmount(transactionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ linkedId, amount }: { linkedId: number; amount: number | null }) =>
      reimbursementsApi.updateAmount(transactionId, linkedId, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reimbursements', transactionId] });
      qc.invalidateQueries({ queryKey: ['reimbursements', 'pending'] });
    },
  });
}

export function useUnlinkReimbursement(transactionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkedId: number) => reimbursementsApi.unlink(transactionId, linkedId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reimbursements', transactionId] });
      qc.invalidateQueries({ queryKey: ['reimbursements', 'pending'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useSetReimbursementStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'en_attente' | 'rembourse' | null }) =>
      reimbursementsApi.setStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['reimbursements', 'pending'] });
    },
  });
}
