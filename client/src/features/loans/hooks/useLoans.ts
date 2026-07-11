import type { CreateLoanPayload, UpdateLoanPayload } from '@cashctrl/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { loansApi } from '@/api/client';
import { fireAndForget } from '@/lib/async';
import { queryKeys } from '@/lib/queryKeys';

export function useLoan(accountId: number) {
  return useQuery({
    queryKey: queryKeys.loans.byAccount(accountId),
    queryFn: () => loansApi.getByAccount(accountId),
    enabled: accountId > 0,
    retry: false,
  });
}

export function useLoanInstallments(loanId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.loans.installments(loanId),
    queryFn: () => loansApi.getInstallments(loanId!),
    enabled: loanId != null && loanId > 0,
  });
}

export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLoanPayload) => loansApi.create(payload),
    onSuccess: () => {
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.accounts() }));
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.transactions.all() }));
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.forecastAll() }));
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.accountBalanceHistoryAll() }));
    },
  });
}

export function useUpdateLoan(loanId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateLoanPayload) => loansApi.update(loanId, payload),
    onSuccess: (loan) => {
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.loans.byAccount(loan.account_id) }));
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.accounts() }));
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.transactions.all() }));
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.forecastAll() }));
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.accountBalanceHistoryAll() }));
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
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.loans.installments(loanId) }));
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.transactions.all() }));
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.forecastAll() }));
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.accountBalanceHistoryAll() }));
    },
  });
}
