import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { USERS } from '@/tests/fixtures';
import { createHookWrapper } from '@/tests/helpers/hookWrapper';
import { server } from '@/tests/msw/server';

import {
  useCreateUser,
  useDeleteUser,
  useDisableUser2fa,
  useUpdateUser,
  useUsers,
} from './useUsers';

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
    result.current.mutate({ username: 'newuser', password: 'password123', lang: 'fr' });
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
    result.current.mutate({ username: 'alice', password: 'password123', lang: 'en' });
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

describe('useUpdateUser — rôle et e-mail', () => {
  it('envoie is_admin et email au serveur', async () => {
    let body: unknown;
    server.use(
      http.patch('/api/users/:id', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(USERS[1]);
      }),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useUpdateUser(), { wrapper: Wrapper });
    result.current.mutate({ id: 2, is_admin: true, email: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(body).toEqual({ is_admin: true, email: null });
  });

  it('passe en erreur sur user.last_admin (409)', async () => {
    server.use(
      http.patch('/api/users/:id', () =>
        HttpResponse.json(
          { error: { code: 'user.last_admin', message: 'Dernier admin' } },
          { status: 409 },
        ),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useUpdateUser(), { wrapper: Wrapper });
    result.current.mutate({ id: 1, is_admin: false });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDisableUser2fa', () => {
  it('désactive la 2FA et invalide la liste', async () => {
    const { Wrapper, qc } = createHookWrapper();
    qc.setQueryData(['users'], USERS);
    const { result } = renderHook(() => useDisableUser2fa(), { wrapper: Wrapper });
    result.current.mutate(2);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ ok: true });
  });

  it('passe en erreur si la 2FA est déjà désactivée (409)', async () => {
    server.use(
      http.delete('/api/users/:id/2fa', () =>
        HttpResponse.json(
          { error: { code: 'auth.totp_not_enabled', message: 'Non activée' } },
          { status: 409 },
        ),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDisableUser2fa(), { wrapper: Wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isError).toBe(true));
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
