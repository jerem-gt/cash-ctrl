import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { TRANSACTIONS } from '@/tests/fixtures';
import { server } from '@/tests/msw/server';

import {
  useCreateTransaction,
  useCreateTransfer,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
  useValidateTransaction,
} from './useTransactions';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('useTransactions', () => {
  it('est en chargement initialement', () => {
    const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it("charge les transactions depuis l'API", async () => {
    const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].description).toBe('Courses');
    expect(result.current.data?.total).toBe(1);
  });

  it("passe en erreur si l'API échoue", async () => {
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json({ error: 'Erreur serveur' }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Erreur serveur');
  });

  it("inclut les filtres dans l'URL", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get('/api/transactions', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ data: [], total: 0, page: 1, totalPages: 1 });
      }),
    );
    const { result } = renderHook(() => useTransactions({ account_id: 5, page: 2 }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedUrl).toContain('account_id=5');
    expect(capturedUrl).toContain('page=2');
  });
});

describe('useCreateTransaction', () => {
  it('crée une transaction et passe en succès', async () => {
    const { result } = renderHook(() => useCreateTransaction(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({
        account_id: 1,
        type: 'expense',
        amount: 24.5,
        description: 'Test',
        subcategory_id: 1,
        date: '2026-01-01',
        payment_method_id: 1,
        notes: null,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useUpdateTransaction', () => {
  it('met à jour une transaction et invalide le cache', async () => {
    const wrapper = createWrapper();
    // Peupler le cache de transactions pour couvrir setQueriesData
    const { result: qResult } = renderHook(() => useTransactions(), { wrapper });
    await waitFor(() => expect(qResult.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useUpdateTransaction(), { wrapper });
    act(() => {
      result.current.mutate({
        id: 10,
        account_id: 1,
        type: 'expense',
        amount: 30,
        description: 'Modifié',
        subcategory_id: 1,
        date: '2026-01-01',
        payment_method_id: 1,
        notes: null,
        validated: false,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('met à jour le peer de transfert si transfer_peer_id est défini', async () => {
    const txWithPeer = { ...TRANSACTIONS.data[0], transfer_peer_id: 11 };
    server.use(http.put('/api/transactions/:id', () => HttpResponse.json(txWithPeer)));
    const wrapper = createWrapper();
    const { result: qResult } = renderHook(() => useTransactions(), { wrapper });
    await waitFor(() => expect(qResult.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useUpdateTransaction(), { wrapper });
    act(() => {
      result.current.mutate({
        id: 10,
        account_id: 1,
        type: 'expense',
        amount: 30,
        description: 'Transfert modifié',
        subcategory_id: 1,
        date: '2026-01-01',
        payment_method_id: 1,
        notes: null,
        validated: false,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useDeleteTransaction', () => {
  it('supprime une transaction et passe en succès', async () => {
    const { result } = renderHook(() => useDeleteTransaction(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate(10);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useValidateTransaction', () => {
  it('valide une transaction et met à jour le cache', async () => {
    const wrapper = createWrapper();
    const { result: qResult } = renderHook(() => useTransactions(), { wrapper });
    await waitFor(() => expect(qResult.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useValidateTransaction(), { wrapper });
    act(() => {
      result.current.mutate({ id: 10, validated: true });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useCreateTransfer', () => {
  it('crée un transfert et passe en succès', async () => {
    const { result } = renderHook(() => useCreateTransfer(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({
        from_account_id: 1,
        to_account_id: 2,
        amount: 100,
        description: 'Virement',
        date: '2026-01-01',
        notes: null,
        validated: false,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
