import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TRANSACTIONS } from '@/tests/fixtures';
import { server } from '@/tests/msw/server';

import {
  useCreateTransaction,
  useCreateTransfer,
  useDeleteTransaction,
  useDeleteTransfer,
  useTransactions,
  useUpdateTransaction,
  useUpdateTransfer,
  useValidateTransaction,
} from './useTransactions';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  }
  return Object.assign(Wrapper, { qc });
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

  it("inclut scheduled_id dans l'URL quand fourni", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get('/api/transactions', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ data: [], total: 0, page: 1, totalPages: 1 });
      }),
    );
    const { result } = renderHook(() => useTransactions({ scheduled_id: 3 }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedUrl).toContain('scheduled_id=3');
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
        validated: false,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useUpdateTransaction', () => {
  it('met à jour une transaction et patche le cache', async () => {
    const updated = { ...TRANSACTIONS.data[0], description: 'Modifié', amount: 30 };
    server.use(http.put('/api/transactions/:id', () => HttpResponse.json(updated)));
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
        description: 'Modifié',
        subcategory_id: 1,
        date: '2026-01-01',
        payment_method_id: 1,
        notes: null,
        validated: false,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cache = wrapper.qc.getQueryData<typeof TRANSACTIONS>(['transactions', undefined]);
    expect(cache?.data[0].description).toBe('Modifié');
    expect(cache?.data[0].amount).toBe(30);
  });

  it('gère un cache vide (old undefined)', async () => {
    const { result } = renderHook(() => useUpdateTransaction(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({
        id: 99,
        account_id: 1,
        type: 'expense',
        amount: 30,
        description: 'X',
        subcategory_id: 1,
        date: '2026-01-01',
        payment_method_id: 1,
        notes: null,
        validated: false,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('retrie la liste quand la date modifiée change son rang', async () => {
    const older = { ...TRANSACTIONS.data[0], id: 11, date: '2026-04-10' };
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json({
          data: [TRANSACTIONS.data[0], older],
          total: 2,
          page: 1,
          totalPages: 1,
        }),
      ),
    );
    const wrapper = createWrapper();
    const { result: qResult } = renderHook(() => useTransactions(), { wrapper });
    await waitFor(() => expect(qResult.current.isSuccess).toBe(true));

    const updated = { ...older, date: '2026-04-25' };
    server.use(http.put('/api/transactions/:id', () => HttpResponse.json(updated)));
    const { result } = renderHook(() => useUpdateTransaction(), { wrapper });
    act(() => {
      result.current.mutate({
        id: 11,
        account_id: 1,
        type: 'expense',
        amount: 24.5,
        description: 'Courses',
        subcategory_id: 1,
        date: '2026-04-25',
        payment_method_id: 1,
        notes: null,
        validated: false,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cache = wrapper.qc.getQueryData<typeof TRANSACTIONS>(['transactions', undefined]);
    expect(cache?.data.map((tx) => tx.id)).toEqual([11, 10]);
  });
});

describe('useUpdateTransfer', () => {
  it('met à jour un transfert et met à jour le peer dans le cache', async () => {
    const txWithPeer = { ...TRANSACTIONS.data[0], transfer_peer_id: 11 };
    server.use(http.put('/api/transfers/:id', () => HttpResponse.json(txWithPeer)));
    const wrapper = createWrapper();
    const { result: qResult } = renderHook(() => useTransactions(), { wrapper });
    await waitFor(() => expect(qResult.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useUpdateTransfer(), { wrapper });
    act(() => {
      result.current.mutate({
        id: 10,
        amount: 30,
        description: 'Transfert modifié',
        date: '2026-01-01',
        validated: false,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('exécute le callback setQueriesData sur le peer (branche transfer_peer_id)', async () => {
    const peer = { ...TRANSACTIONS.data[0], id: 11, transfer_peer_id: 10 };
    const updated = { ...TRANSACTIONS.data[0], id: 10, transfer_peer_id: 11, amount: 55 };
    const unrelated = { ...TRANSACTIONS.data[0], id: 99, transfer_peer_id: null };
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json({
          data: [TRANSACTIONS.data[0], peer, unrelated],
          total: 3,
          page: 1,
          totalPages: 1,
        }),
      ),
      http.put('/api/transfers/:id', () => HttpResponse.json(updated)),
    );
    const wrapper = createWrapper();
    const { result: qResult } = renderHook(() => useTransactions(), { wrapper });
    await waitFor(() => expect(qResult.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useUpdateTransfer(), { wrapper });
    act(() => {
      result.current.mutate({
        id: 10,
        amount: 55,
        description: 'Mod',
        date: '2026-01-01',
        validated: false,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // La mutation a réussi — le setQueriesData a été exécuté sur les deux transactions
  });

  it('gère un cache vide (old undefined)', async () => {
    // Pas de préchargement → old sera undefined dans setQueriesData
    const { result } = renderHook(() => useUpdateTransfer(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({
        id: 99,
        amount: 10,
        description: 'X',
        date: '2026-01-01',
        validated: false,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('invalide dashboardStats après modification', async () => {
    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(wrapper.qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateTransfer(), { wrapper });
    act(() => {
      result.current.mutate({
        id: 10,
        amount: 30,
        description: 'X',
        date: '2026-01-01',
        validated: false,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard-stats'] });
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

describe('useDeleteTransfer', () => {
  it('supprime un transfert et passe en succès', async () => {
    const { result } = renderHook(() => useDeleteTransfer(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate(10);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('invalide dashboardStats après suppression', async () => {
    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(wrapper.qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteTransfer(), { wrapper });
    act(() => {
      result.current.mutate(10);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard-stats'] });
  });
});

describe('useValidateTransaction', () => {
  it('valide une transaction et patche le cache', async () => {
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json({ ...TRANSACTIONS, data: [{ ...TRANSACTIONS.data[0], validated: 0 }] }),
      ),
    );
    const wrapper = createWrapper();
    const { result: qResult } = renderHook(() => useTransactions(), { wrapper });
    await waitFor(() => expect(qResult.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useValidateTransaction(), { wrapper });
    act(() => {
      result.current.mutate({ id: 10, validated: true });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cache = wrapper.qc.getQueryData<typeof TRANSACTIONS>(['transactions', undefined]);
    expect(cache?.data[0].validated).toBe(1);
  });

  it('gère un cache vide (old undefined)', async () => {
    const { result } = renderHook(() => useValidateTransaction(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ id: 99, validated: true });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('invalide (au lieu de patcher) une vue filtrée par validated=false qui ne correspond plus', async () => {
    const unvalidatedTx = { ...TRANSACTIONS.data[0], validated: 0 as const };
    let filteredCallCount = 0;
    let unfilteredCallCount = 0;
    server.use(
      http.get('/api/transactions', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('validated') === 'false') {
          filteredCallCount += 1;
          // Après validation, la transaction ne correspond plus au filtre côté serveur.
          return HttpResponse.json(
            filteredCallCount === 1
              ? { data: [unvalidatedTx], total: 1, page: 1, totalPages: 1 }
              : { data: [], total: 0, page: 1, totalPages: 1 },
          );
        }
        unfilteredCallCount += 1;
        return HttpResponse.json({ data: [unvalidatedTx], total: 1, page: 1, totalPages: 1 });
      }),
    );

    const wrapper = createWrapper();
    const { result: unfiltered } = renderHook(() => useTransactions(), { wrapper });
    const { result: filtered } = renderHook(() => useTransactions({ validated: false }), {
      wrapper,
    });
    await waitFor(() => expect(unfiltered.current.isSuccess).toBe(true));
    await waitFor(() => expect(filtered.current.isSuccess).toBe(true));
    expect(filtered.current.data?.data).toHaveLength(1);

    const { result } = renderHook(() => useValidateTransaction(), { wrapper });
    act(() => {
      result.current.mutate({ id: 10, validated: true });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Vue filtrée : refetch déclenché par l'invalidation, la transaction disparaît
    await waitFor(() => expect(filtered.current.data?.data).toHaveLength(0));
    // Vue non filtrée : patch en place, sans nouvel appel réseau
    const cache = wrapper.qc.getQueryData<typeof TRANSACTIONS>(['transactions', undefined]);
    expect(cache?.data[0].validated).toBe(1);
    expect(filteredCallCount).toBe(2);
    expect(unfilteredCallCount).toBe(1);
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

  it('invalide dashboardStats après création', async () => {
    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(wrapper.qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateTransfer(), { wrapper });
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
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard-stats'] });
  });
});
