import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { PENDING_REIMBURSEMENTS, REIMBURSEMENTS, TRANSACTIONS } from '@/tests/fixtures';
import { server } from '@/tests/msw/server';

import {
  useLinkReimbursement,
  usePendingReimbursements,
  useReimbursements,
  useSetReimbursementStatus,
  useUnlinkReimbursement,
} from './useReimbursements';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('usePendingReimbursements', () => {
  it("charge les remboursements en attente depuis l'API", async () => {
    const { result } = renderHook(() => usePendingReimbursements(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].id).toBe(PENDING_REIMBURSEMENTS[0].id);
    expect(result.current.data![0].total_reimbursed).toBe(45);
  });

  it("passe en erreur si l'API échoue", async () => {
    server.use(
      http.get('/api/reimbursements/pending', () =>
        HttpResponse.json({ error: 'Erreur serveur' }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => usePendingReimbursements(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useReimbursements', () => {
  it('charge les remboursements pour une transaction', async () => {
    const { result } = renderHook(() => useReimbursements(10), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].id).toBe(REIMBURSEMENTS[0].id);
    expect(result.current.data![0].description).toBe('Remboursement CPAM');
  });

  it('est désactivé si transactionId vaut 0', () => {
    const { result } = renderHook(() => useReimbursements(0), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useLinkReimbursement', () => {
  it('lie un remboursement et passe en succès', async () => {
    const { result } = renderHook(() => useLinkReimbursement(10), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.mutate(20);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it("passe en erreur si l'API échoue", async () => {
    server.use(
      http.post('/api/reimbursements/:transactionId', () =>
        HttpResponse.json({ error: 'Transaction introuvable' }, { status: 404 }),
      ),
    );
    const { result } = renderHook(() => useLinkReimbursement(10), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.mutate(99);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('Transaction introuvable');
  });
});

describe('useUnlinkReimbursement', () => {
  it('délie un remboursement et passe en succès', async () => {
    const { result } = renderHook(() => useUnlinkReimbursement(10), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.mutate(20);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.ok).toBe(true);
  });
});

describe('useSetReimbursementStatus', () => {
  it('met à jour le status et invalide les caches transactions et pending', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSetReimbursementStatus(), { wrapper });

    act(() => {
      result.current.mutate({ id: 10, status: 'en_attente' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.reimbursement_status).toBe('en_attente');
  });

  it('accepte null pour désactiver le suivi', async () => {
    server.use(
      http.patch('/api/reimbursements/:transactionId/status', () =>
        HttpResponse.json({ ...TRANSACTIONS.data[0], reimbursement_status: null }),
      ),
    );
    const { result } = renderHook(() => useSetReimbursementStatus(), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.mutate({ id: 10, status: null });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.reimbursement_status).toBeNull();
  });

  it("passe en erreur si l'API échoue", async () => {
    server.use(
      http.patch('/api/reimbursements/:transactionId/status', () =>
        HttpResponse.json({ error: 'Transaction introuvable' }, { status: 404 }),
      ),
    );
    const { result } = renderHook(() => useSetReimbursementStatus(), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.mutate({ id: 99999, status: 'en_attente' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('Transaction introuvable');
  });
});
