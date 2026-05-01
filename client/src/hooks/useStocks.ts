import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { type StockOperationPayload, stocksApi } from '@/api/client';

export function useStockPositions(accountId: number) {
  return useQuery({
    queryKey: ['stock-positions', accountId],
    queryFn: () => stocksApi.positions(accountId),
    enabled: accountId > 0,
  });
}

export function useStockOperations(accountId: number) {
  return useQuery({
    queryKey: ['stock-operations', accountId],
    queryFn: () => stocksApi.operations(accountId),
    enabled: accountId > 0,
  });
}

export function useBuyStock(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: StockOperationPayload) => stocksApi.buy(accountId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-positions', accountId] });
      qc.invalidateQueries({ queryKey: ['stock-operations', accountId] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useSellStock(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: StockOperationPayload) => stocksApi.sell(accountId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-positions', accountId] });
      qc.invalidateQueries({ queryKey: ['stock-operations', accountId] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useRefreshPrices(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => stocksApi.refreshPrices(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-positions', accountId] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
