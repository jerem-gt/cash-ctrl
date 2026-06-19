import type { CreateLoanPayload, UpdateLoanPayload } from '@cashctrl/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { loansApi } from '@/api/client';
import { queryKeys } from '@/lib/queryKeys';

export function useLoan(accountId: number) {
  return useQuery({
    queryKey: queryKeys.loanByAccount(accountId),
    queryFn: () => loansApi.getByAccount(accountId),
    enabled: accountId > 0,
    retry: false,
  });
}

export function useLoanInstallments(loanId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.loanInstallments(loanId),
    queryFn: () => loansApi.getInstallments(loanId!),
    enabled: loanId != null && loanId > 0,
  });
}

export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLoanPayload) => loansApi.create(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.accounts() });
      void qc.invalidateQueries({ queryKey: queryKeys.transactions.all() });
    },
  });
}

export function useUpdateLoan(loanId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateLoanPayload) => loansApi.update(loanId, payload),
    onSuccess: (loan) => {
      void qc.invalidateQueries({ queryKey: queryKeys.loanByAccount(loan.account_id) });
      void qc.invalidateQueries({ queryKey: queryKeys.accounts() });
      void qc.invalidateQueries({ queryKey: queryKeys.transactions.all() });
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
      void qc.invalidateQueries({ queryKey: queryKeys.loanInstallments(loanId) });
      void qc.invalidateQueries({ queryKey: queryKeys.transactions.all() });
    },
  });
}
