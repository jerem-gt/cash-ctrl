import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { USERS } from '@/tests/fixtures';
import { createHookWrapper } from '@/tests/helpers/hookWrapper';
import { server } from '@/tests/msw/server';

import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from './useUsers';

describe('useUsers', () => {
  it('charge la liste des utilisateurs', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useUsers(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].username).toBe('admin');
  });
});

describe('useCreateUser', () => {
  it('crée un utilisateur et invalide le cache', async () => {
    const { Wrapper, qc } = createHookWrapper();
    qc.setQueryData(['users'], USERS);
    const { result } = renderHook(() => useCreateUser(), { wrapper: Wrapper });
    result.current.mutate({ username: 'newuser', password: 'password123' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.username).toBe('newuser');
  });

  it('passe en erreur si le username est déjà pris', async () => {
    server.use(
      http.post('/api/users', () =>
        HttpResponse.json({ error: 'Username already taken' }, { status: 409 }),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCreateUser(), { wrapper: Wrapper });
    result.current.mutate({ username: 'alice', password: 'password123' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Username already taken');
  });
});

describe('useUpdateUser', () => {
  it("modifie l'utilisateur et invalide le cache", async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useUpdateUser(), { wrapper: Wrapper });
    result.current.mutate({ id: 2, username: 'updated' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.username).toBe('updated');
  });
});

describe('useDeleteUser', () => {
  it("supprime l'utilisateur et invalide le cache", async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDeleteUser(), { wrapper: Wrapper });
    result.current.mutate(2);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
