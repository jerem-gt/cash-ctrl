import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type ArbitragePayload,
  type CreateSupportPayload,
  insuranceApi,
  type InsuranceFlowPayload,
  type InteretsPayload,
} from '@/api/client';

export function useInsurancePositions(accountId: number) {
  return useQuery({
    queryKey: ['insurance-positions', accountId],
    queryFn: () => insuranceApi.positions(accountId),
    enabled: accountId > 0,
  });
}

export function useInsuranceOperations(accountId: number) {
  return useQuery({
    queryKey: ['insurance-operations', accountId],
    queryFn: () => insuranceApi.operations(accountId),
    enabled: accountId > 0,
  });
}

export function useInsuranceSupports(accountId: number) {
  return useQuery({
    queryKey: ['insurance-supports', accountId],
    queryFn: () => insuranceApi.supports(accountId),
    enabled: accountId > 0,
  });
}

function useInvalidate(accountId: number) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['insurance-positions', accountId] });
    qc.invalidateQueries({ queryKey: ['insurance-operations', accountId] });
    qc.invalidateQueries({ queryKey: ['accounts'] });
    qc.invalidateQueries({ queryKey: ['transactions'] });
  };
}

export function useCreateInsuranceSupport(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSupportPayload) => insuranceApi.createSupport(accountId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insurance-supports', accountId] });
      qc.invalidateQueries({ queryKey: ['insurance-positions', accountId] });
    },
  });
}

export function useDeleteInsuranceSupport(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (supportId: number) => insuranceApi.deleteSupport(accountId, supportId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insurance-supports', accountId] });
      qc.invalidateQueries({ queryKey: ['insurance-positions', accountId] });
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

export function useRefreshInsurancePrices(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => insuranceApi.refreshPrices(accountId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insurance-positions', accountId] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
