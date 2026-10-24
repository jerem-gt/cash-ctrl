import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { createHookWrapper, spyInvalidations } from '@/tests/helpers/hookWrapper';
import { server } from '@/tests/msw/server';

import {
  useAccounts,
  useCloseAccount,
  useCreateAccount,
  useDeleteAccount,
  useReopenAccount,
  useReorderFavorites,
  useToggleFavorite,
  useUpdateAccount,
} from './useAccounts';

describe('useAccounts', () => {
  it('charge les comptes', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useAccounts(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(3);
    expect(result.current.data![0].name).toBe('Compte test');
  });
});

describe('useCreateAccount', () => {
  it('crée un compte avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCreateAccount(), { wrapper: Wrapper });
    result.current.mutate({
      name: 'Nouveau',
      bank_id: 1,
      account_type_id: 1,
      initial_balance: 0,
      opening_date: '2024-01-01',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("passe en erreur si l'API échoue", async () => {
    server.use(
      http.post('/api/accounts', () => HttpResponse.json({ error: 'Erreur' }, { status: 400 })),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCreateAccount(), { wrapper: Wrapper });
    result.current.mutate({
      name: 'x',
      bank_id: 1,
      account_type_id: 1,
      initial_balance: 0,
      opening_date: '2024-01-01',
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Erreur');
  });
});

describe('useUpdateAccount', () => {
  it('met à jour un compte avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useUpdateAccount(), { wrapper: Wrapper });
    result.current.mutate({
      id: 1,
      name: 'Modifié',
      bank_id: 1,
      account_type_id: 1,
      initial_balance: 0,
      opening_date: '2024-01-01',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useDeleteAccount', () => {
  it('supprime un compte avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDeleteAccount(), { wrapper: Wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useReopenAccount', () => {
  it('rouvre le compte avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useReopenAccount(), { wrapper: Wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("passe en erreur si l'API échoue", async () => {
    server.use(
      http.post('/api/accounts/:id/reopen', () =>
        HttpResponse.json({ error: 'Réouverture impossible' }, { status: 400 }),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useReopenAccount(), { wrapper: Wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Réouverture impossible');
  });
});

describe('useCloseAccount', () => {
  it('clôture le compte avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCloseAccount(), { wrapper: Wrapper });
    result.current.mutate({ id: 1, closed_at: '2025-01-01' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("passe en erreur si l'API échoue", async () => {
    server.use(
      http.post('/api/accounts/:id/close', () =>
        HttpResponse.json({ error: 'Clôture impossible' }, { status: 400 }),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCloseAccount(), { wrapper: Wrapper });
    result.current.mutate({ id: 1, closed_at: '2025-01-01' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Clôture impossible');
  });
});

describe('invalidation des comptes', () => {
  it('useUpdateAccount invalide les comptes et tout ce qui dépend des soldes', async () => {
    const { qc, Wrapper } = createHookWrapper();
    const keys = spyInvalidations(qc);
    const { result } = renderHook(() => useUpdateAccount(), { wrapper: Wrapper });
    result.current.mutate({
      id: 1,
      name: 'Modifié',
      bank_id: 1,
      account_type_id: 1,
      initial_balance: 0,
      opening_date: '2024-01-01',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(keys()).toEqual(
      expect.arrayContaining([
        ['accounts'],
        ['dashboard-stats'],
        ['forecast'],
        ['account-balance-history'],
        ['balance-history'],
        ['profitability'],
      ]),
    );
  });

  it('useDeleteAccount invalide aussi les transactions', async () => {
    const { qc, Wrapper } = createHookWrapper();
    const keys = spyInvalidations(qc);
    const { result } = renderHook(() => useDeleteAccount(), { wrapper: Wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(keys()).toEqual(expect.arrayContaining([['accounts'], ['transactions']]));
  });
});

describe('useToggleFavorite', () => {
  it('met à jour le cache de façon optimiste puis valide', async () => {
    const { qc, Wrapper } = createHookWrapper();
    const { result } = renderHook(() => ({ q: useAccounts(), m: useToggleFavorite() }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.q.isSuccess).toBe(true));
    result.current.m.mutate({ id: 1, favorite: true });
    await waitFor(() => expect(result.current.m.isSuccess).toBe(true));
    expect(qc.getQueryState(['accounts'])).toBeDefined();
  });

  it("restaure le cache si l'API échoue", async () => {
    server.use(
      http.put('/api/accounts/:id/favorite', () =>
        HttpResponse.json({ error: 'Refusé' }, { status: 409 }),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => ({ q: useAccounts(), m: useToggleFavorite() }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.q.isSuccess).toBe(true));
    result.current.m.mutate({ id: 1, favorite: true });
    await waitFor(() => expect(result.current.m.isError).toBe(true));
    expect(result.current.m.error?.message).toBe('Refusé');
    await waitFor(() =>
      expect(result.current.q.data?.find((a) => a.id === 1)?.favorite_order).toBeNull(),
    );
  });
});

describe('useReorderFavorites', () => {
  it('réordonne les favoris avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useReorderFavorites(), { wrapper: Wrapper });
    result.current.mutate([
      { id: 1, favorite_order: 1 },
      { id: 2, favorite_order: 0 },
    ]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("passe en erreur si l'API échoue", async () => {
    server.use(
      http.put('/api/accounts/favorites/reorder', () =>
        HttpResponse.json({ error: 'Échec' }, { status: 400 }),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useReorderFavorites(), { wrapper: Wrapper });
    result.current.mutate([{ id: 1, favorite_order: 0 }]);
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
