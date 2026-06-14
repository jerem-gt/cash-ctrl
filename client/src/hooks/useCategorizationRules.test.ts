import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '@/tests/msw/server';

import {
  useCategorizationRules,
  useCreateCategorizationRule,
  useDeleteAllCategorizationRules,
  useDeleteCategorizationRule,
  useInitCategorizationRulesFromHistory,
  useMatchCategorizationRule,
  useUpdateCategorizationRule,
} from './useCategorizationRules';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  }
  return Object.assign(Wrapper, { qc });
}

const RULE = { id: 1, user_id: 1, pattern: '%leclerc%', subcategory_id: 1, sort_order: 0 };

describe('useCategorizationRules', () => {
  it("charge la liste depuis l'API", async () => {
    server.use(http.get('/api/categorization-rules', () => HttpResponse.json([RULE])));
    const { result } = renderHook(() => useCategorizationRules(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].pattern).toBe('%leclerc%');
  });
});

describe('useMatchCategorizationRule', () => {
  it('retourne null quand description < 2 caractères (désactivé)', () => {
    const { result } = renderHook(() => useMatchCategorizationRule('a'), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('retourne la règle correspondante', async () => {
    server.use(http.get('/api/categorization-rules/match', () => HttpResponse.json(RULE)));
    const { result } = renderHook(() => useMatchCategorizationRule('Courses Leclerc'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pattern).toBe('%leclerc%');
  });

  it('retourne null si aucune règle ne correspond', async () => {
    const { result } = renderHook(() => useMatchCategorizationRule('LOYER'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

describe('useCreateCategorizationRule', () => {
  it('appelle POST et invalide le cache', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateCategorizationRule(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ pattern: '%leclerc%', subcategoryId: 1 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useUpdateCategorizationRule', () => {
  it('appelle PUT et invalide le cache', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateCategorizationRule(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 1, pattern: '%carrefour%', subcategoryId: 1 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useDeleteCategorizationRule', () => {
  it('appelle DELETE /:id et invalide le cache', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteCategorizationRule(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(1);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useDeleteAllCategorizationRules', () => {
  it('appelle DELETE / et invalide le cache', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteAllCategorizationRules(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(undefined);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useInitCategorizationRulesFromHistory', () => {
  it('appelle POST /init-from-history et retourne le nombre inséré', async () => {
    server.use(
      http.post('/api/categorization-rules/init-from-history', () =>
        HttpResponse.json({ inserted: 3 }, { status: 201 }),
      ),
    );
    const wrapper = createWrapper();
    const { result } = renderHook(() => useInitCategorizationRulesFromHistory(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(undefined);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.inserted).toBe(3);
  });
});
