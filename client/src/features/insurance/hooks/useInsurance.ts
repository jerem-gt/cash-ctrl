import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type ArbitragePayload,
  type CreateSupportPayload,
  insuranceApi,
  type InsuranceFlowPayload,
  type InteretsPayload,
  type RevaloriserPayload,
} from '@/api/client';
import { queryKeys } from '@/lib/queryKeys';

export function useInsurancePositions(accountId: number) {
  return useQuery({
    queryKey: queryKeys.insurancePositions(accountId),
    queryFn: () => insuranceApi.positions(accountId),
    enabled: accountId > 0,
  });
}

export function useInsuranceOperations(accountId: number) {
  return useQuery({
    queryKey: queryKeys.insuranceOperations(accountId),
    queryFn: () => insuranceApi.operations(accountId),
    enabled: accountId > 0,
  });
}

export function useInsuranceSupports(accountId: number) {
  return useQuery({
    queryKey: queryKeys.insuranceSupports(accountId),
    queryFn: () => insuranceApi.supports(accountId),
    enabled: accountId > 0,
  });
}

function useInvalidate(accountId: number) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.insurancePositions(accountId) });
    void qc.invalidateQueries({ queryKey: queryKeys.insuranceOperations(accountId) });
    void qc.invalidateQueries({ queryKey: queryKeys.accounts() });
    void qc.invalidateQueries({ queryKey: queryKeys.transactions.all() });
  };
}

export function useCreateInsuranceSupport(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSupportPayload) => insuranceApi.createSupport(accountId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.insuranceSupports(accountId) });
      void qc.invalidateQueries({ queryKey: queryKeys.insurancePositions(accountId) });
    },
  });
}

export function useDeleteInsuranceOperation(accountId: number) {
  const invalidate = useInvalidate(accountId);
  return useMutation({
    mutationFn: (operationId: number) => insuranceApi.deleteOperation(accountId, operationId),
    onSuccess: invalidate,
  });
}

export function useUpdateInsuranceOperation(accountId: number) {
  const invalidate = useInvalidate(accountId);
  return useMutation({
    mutationFn: ({
      operationId,
      amount,
      fees,
      social_fees,
      date,
    }: {
      operationId: number;
      amount: number;
      fees: number;
      social_fees?: number;
      date: string;
    }) => insuranceApi.updateOperation(accountId, operationId, { amount, fees, social_fees, date }),
    onSuccess: invalidate,
  });
}

export function useDeleteInsuranceSupport(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (supportId: number) => insuranceApi.deleteSupport(accountId, supportId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.insuranceSupports(accountId) });
      void qc.invalidateQueries({ queryKey: queryKeys.insurancePositions(accountId) });
    },
  });
}

export function useVersement(accountId: number) {
  const invalidate = useInvalidate(accountId);
  return useMutation({
    mutationFn: (payload: InsuranceFlowPayload) => insuranceApi.versement(accountId, payload),
    onSuccess: invalidate,
  });
}

export function useRachat(accountId: number) {
  const invalidate = useInvalidate(accountId);
  return useMutation({
    mutationFn: (payload: InsuranceFlowPayload) => insuranceApi.rachat(accountId, payload),
    onSuccess: invalidate,
  });
}

export function useArbitrage(accountId: number) {
  const invalidate = useInvalidate(accountId);
  return useMutation({
    mutationFn: (payload: ArbitragePayload) => insuranceApi.arbitrage(accountId, payload),
    onSuccess: invalidate,
  });
}

export function useInterets(accountId: number) {
  const invalidate = useInvalidate(accountId);
  return useMutation({
    mutationFn: (payload: InteretsPayload) => insuranceApi.interets(accountId, payload),
    onSuccess: invalidate,
  });
}

export function useRevalorisation(accountId: number) {
  const invalidate = useInvalidate(accountId);
  return useMutation({
    mutationFn: (payload: RevaloriserPayload) => insuranceApi.revaloriser(accountId, payload),
    onSuccess: invalidate,
  });
}
