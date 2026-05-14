import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { STOCK_OPERATIONS, STOCK_POSITIONS } from '@/tests/fixtures';
import { server } from '@/tests/msw/server';

import {
  useBuyStock,
  useRefreshPrices,
  useSellStock,
  useStockOperations,
  useStockPositions,
  useStockSearch,
  useTransferStock,
  useUpdateStockOperation,
} from './useStocks';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

// ─── useStockSearch ───────────────────────────────────────────────────────────

describe('useStockSearch', () => {
  it('ne déclenche pas de requête pour un query non-ISIN', () => {
    const { result } = renderHook(() => useStockSearch('AAPL'), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('déclenche la requête pour un ISIN valide', async () => {
    const { result } = renderHook(() => useStockSearch('FR0014000MR3'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it('ne déclenche pas de requête pour un query vide', () => {
    const { result } = renderHook(() => useStockSearch(''), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
  });
});

// ─── useStockPositions ────────────────────────────────────────────────────────

describe('useStockPositions', () => {
  it('charge les positions pour un compte valide', async () => {
    const { result } = renderHook(() => useStockPositions(3), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(STOCK_POSITIONS);
  });

  it('ne déclenche pas de requête pour accountId=0', () => {
    const { result } = renderHook(() => useStockPositions(0), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ─── useStockOperations ───────────────────────────────────────────────────────

describe('useStockOperations', () => {
  it('charge les opérations pour un compte valide', async () => {
    const { result } = renderHook(() => useStockOperations(3), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(STOCK_OPERATIONS);
  });

  it('ne déclenche pas de requête pour accountId=0', () => {
    const { result } = renderHook(() => useStockOperations(0), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ─── useBuyStock ──────────────────────────────────────────────────────────────

describe('useBuyStock', () => {
  it('enregistre un achat et invalide le cache', async () => {
    const { result } = renderHook(() => useBuyStock(3), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({
        ticker: 'DCAM.PA',
        quantity: 10,
        price_per_share: 12,
        fees: 0,
        date: '2026-01-01',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("affiche une erreur si l'API échoue", async () => {
    server.use(
      http.post('/api/stocks/:accountId/buy', () =>
        HttpResponse.json({ error: 'Erreur serveur' }, { status: 400 }),
      ),
    );
    const { result } = renderHook(() => useBuyStock(3), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({
        ticker: 'X',
        quantity: 1,
        price_per_share: 1,
        fees: 0,
        date: '2026-01-01',
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── useSellStock ─────────────────────────────────────────────────────────────

describe('useSellStock', () => {
  it('enregistre une vente et invalide le cache', async () => {
    const { result } = renderHook(() => useSellStock(3), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({
        ticker: 'DCAM.PA',
        quantity: 5,
        price_per_share: 15,
        fees: 0,
        date: '2026-01-01',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ─── useRefreshPrices ─────────────────────────────────────────────────────────

describe('useRefreshPrices', () => {
  it('rafraîchit les cours et invalide le cache', async () => {
    const { result } = renderHook(() => useRefreshPrices(3), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ─── useTransferStock ─────────────────────────────────────────────────────────

describe('useTransferStock', () => {
  it('transfère des titres et invalide les caches source et cible', async () => {
    const { result } = renderHook(() => useTransferStock(3), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({
        to_account_id: 5,
        ticker: 'DCAM.PA',
        quantity: 3,
        date: '2026-01-01',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ─── useUpdateStockOperation ──────────────────────────────────────────────────

describe('useUpdateStockOperation', () => {
  it('met à jour une opération et invalide le cache', async () => {
    const { result } = renderHook(() => useUpdateStockOperation(3), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({
        operationId: STOCK_OPERATIONS[0].id,
        quantity: 10,
        price_per_share: 13,
        fees: 0,
        date: '2026-01-01',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
