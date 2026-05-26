import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { type CreateLoanPayload, loansApi, type UpdateLoanPayload } from '@/api/client';

export function useLoan(accountId: number) {
  return useQuery({
    queryKey: ['loans', 'account', accountId],
    queryFn: () => loansApi.getByAccount(accountId),
    enabled: accountId > 0,
    retry: false,
  });
}

export function useLoanInstallments(loanId: number | undefined) {
  return useQuery({
    queryKey: ['loans', 'installments', loanId],
    queryFn: () => loansApi.getInstallments(loanId!),
    enabled: loanId != null && loanId > 0,
  });
}

export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLoanPayload) => loansApi.create(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      void qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useUpdateLoan(loanId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateLoanPayload) => loansApi.update(loanId, payload),
    onSuccess: (loan) => {
      void qc.invalidateQueries({ queryKey: ['loans', 'account', loan.account_id] });
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      void qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useUpdateInstallment(loanId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      installmentId,
      ...data
    }: {
      installmentId: number;
      due_date: string;
      total_amount: number;
    }) => loansApi.updateInstallment(loanId, installmentId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['loans', 'installments', loanId] });
      void qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
