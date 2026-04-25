import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { createHookWrapper } from '@/tests/helpers/hookWrapper';
import { server } from '@/tests/msw/server';

import { useAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount } from './useAccounts';

describe('useAccounts', () => {
  it('charge les comptes', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useAccounts(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe('Compte courant');
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
