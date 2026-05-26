import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type StockOperationPayload,
  stocksApi,
  type StockSearchResult,
  type TransferStockPayload,
  type UpdateOperationPayload,
} from '@/api/client';

const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{10}$/i;

export function useStockSearch(query: string) {
  return useQuery<StockSearchResult[]>({
    queryKey: ['stock-search', query.toUpperCase()],
    queryFn: () => stocksApi.search(query),
    enabled: ISIN_REGEX.test(query.trim()),
    staleTime: 5 * 60 * 1000,
  });
}

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
      void qc.invalidateQueries({ queryKey: ['stock-positions', accountId] });
      void qc.invalidateQueries({ queryKey: ['stock-operations', accountId] });
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      void qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useSellStock(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: StockOperationPayload) => stocksApi.sell(accountId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock-positions', accountId] });
      void qc.invalidateQueries({ queryKey: ['stock-operations', accountId] });
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      void qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useRefreshPrices(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => stocksApi.refreshPrices(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock-positions', accountId] });
      void qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useTransferStock(fromAccountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TransferStockPayload) => stocksApi.transfer(fromAccountId, payload),
    onSuccess: ({ inOperation }) => {
      void qc.invalidateQueries({ queryKey: ['stock-positions', fromAccountId] });
      void qc.invalidateQueries({ queryKey: ['stock-operations', fromAccountId] });
      void qc.invalidateQueries({ queryKey: ['stock-positions', inOperation.account_id] });
      void qc.invalidateQueries({ queryKey: ['stock-operations', inOperation.account_id] });
      void qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useUpdateStockOperation(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ operationId, ...data }: { operationId: number } & UpdateOperationPayload) =>
      stocksApi.updateOperation(accountId, operationId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock-positions', accountId] });
      void qc.invalidateQueries({ queryKey: ['stock-operations', accountId] });
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      void qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
