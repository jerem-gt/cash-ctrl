import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '@/tests/msw/server';

import { useTransactions } from './useTransactions';

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
