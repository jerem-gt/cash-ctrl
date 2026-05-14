import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import {
  useArbitrage,
  useCreateInsuranceSupport,
  useDeleteInsuranceSupport,
  useInsuranceOperations,
  useInsurancePositions,
  useInsuranceSupports,
  useInterets,
  useRachat,
  useRevalorisation,
  useVersement,
} from './useInsurance';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('useInsurancePositions', () => {
  it('charge les positions pour un compte valide', async () => {
    const { result } = renderHook(() => useInsurancePositions(10), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('ne déclenche pas de requête pour accountId=0', () => {
    const { result } = renderHook(() => useInsurancePositions(0), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
  });
});

describe('useInsuranceOperations', () => {
  it('charge les opérations pour un compte valide', async () => {
    const { result } = renderHook(() => useInsuranceOperations(10), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('ne déclenche pas de requête pour accountId=0', () => {
    const { result } = renderHook(() => useInsuranceOperations(0), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
  });
});

describe('useInsuranceSupports', () => {
  it('charge les supports pour un compte valide', async () => {
    const { result } = renderHook(() => useInsuranceSupports(10), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('ne déclenche pas de requête pour accountId=0', () => {
    const { result } = renderHook(() => useInsuranceSupports(0), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
  });
});

describe('useCreateInsuranceSupport', () => {
  it('crée un support et invalide le cache', async () => {
    const { result } = renderHook(() => useCreateInsuranceSupport(10), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.mutate({ name: 'Fonds Euro', type: 'euro', ticker: null });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useDeleteInsuranceSupport', () => {
  it('supprime un support et invalide le cache', async () => {
    const { result } = renderHook(() => useDeleteInsuranceSupport(10), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.mutate(99);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useVersement', () => {
  it('crée un versement et invalide le cache', async () => {
    const { result } = renderHook(() => useVersement(10), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({
        support_id: 1,
        amount: 1000,
        fees: 0,
        date: '2026-01-01',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useRachat', () => {
  it('crée un rachat et invalide le cache', async () => {
    const { result } = renderHook(() => useRachat(10), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({
        support_id: 1,
        amount: 500,
        fees: 0,
        date: '2026-01-01',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useArbitrage', () => {
  it('crée un arbitrage et invalide le cache', async () => {
    const { result } = renderHook(() => useArbitrage(10), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({
        from_support_id: 1,
        to_support_id: 2,
        from_amount: 500,
        fees: 0,
        date: '2026-01-01',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useInterets', () => {
  it('crée une opération intérêts et invalide le cache', async () => {
    const { result } = renderHook(() => useInterets(10), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ support_id: 1, amount: 150, date: '2026-01-01' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useRevalorisation', () => {
  it('crée une revalorisation et invalide le cache', async () => {
    const { result } = renderHook(() => useRevalorisation(10), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ support_id: 2, amount: 150, date: '2026-01-01' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
