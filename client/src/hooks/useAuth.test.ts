import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { createHookWrapper } from '@/tests/helpers/hookWrapper';
import { server } from '@/tests/msw/server';

import { useChangePassword, useLogin, useLogout, useMe } from './useAuth';

describe('useMe', () => {
  it("charge les infos de l'utilisateur connecté", async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useMe(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.username).toBe('test');
  });

  it('passe en erreur sans retry si non authentifié', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useMe(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.failureCount).toBe(1); // retry: false
  });
});

describe('useLogin', () => {
  it('injecte les données utilisateur dans le cache [me]', async () => {
    const { Wrapper, qc } = createHookWrapper();
    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });
    result.current.mutate({ username: 'test', password: 'pass' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryData(['me'])).toEqual({ username: 'test' });
  });

  it('passe en erreur si identifiants incorrects', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ error: 'Identifiants invalides' }, { status: 401 }),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });
    result.current.mutate({ username: 'bad', password: 'bad' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Identifiants invalides');
  });
});

describe('useLogout', () => {
  it('efface les données [me] du cache', async () => {
    const { Wrapper, qc } = createHookWrapper();
    qc.setQueryData(['me'], { username: 'test' });
    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryData(['me'])).toBeNull();
  });
});

describe('useChangePassword', () => {
  it('soumet le changement de mot de passe', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useChangePassword(), { wrapper: Wrapper });
    result.current.mutate({ current: 'old', next: 'newpass1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
