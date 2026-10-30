import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/queryKeys';
import { queryPersister } from '@/lib/queryPersister';
import { ME, TRUSTED_DEVICES } from '@/tests/fixtures';
import { createHookWrapper } from '@/tests/helpers/hookWrapper';
import { server } from '@/tests/msw/server';

import {
  useChangePassword,
  useDisable2FA,
  useEnable2FA,
  useForgetAllDevices,
  useForgetDevice,
  useForgotPassword,
  useLogin,
  useLogout,
  useMe,
  useResetPassword,
  useSendTestEmail,
  useSetup,
  useSetupStatus,
  useTrustedDevices,
  useUpdateProfile,
  useVerifyTotp,
} from './useAuth';

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
    expect(qc.getQueryData(['me'])).toEqual(ME);
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

describe('useLogout cache persisté', () => {
  it('supprime le cache persisté et vide les autres requêtes', async () => {
    const spy = vi.spyOn(queryPersister, 'removeClient').mockResolvedValue(undefined);
    const { Wrapper, qc } = createHookWrapper();
    qc.setQueryData(['accounts'], [1]);
    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalled();
    expect(qc.getQueryData(['accounts'])).toBeUndefined();
    spy.mockRestore();
  });

  it('ne bloque pas le logout si removeClient échoue', async () => {
    const spy = vi.spyOn(queryPersister, 'removeClient').mockRejectedValue(new Error('idb'));
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    spy.mockRestore();
  });
});

describe('isolation du cache par utilisateur', () => {
  it('purge le cache quand un autre utilisateur se connecte', async () => {
    localStorage.setItem('cashctrl.cacheOwner', 'alice');
    const spy = vi.spyOn(queryPersister, 'removeClient').mockResolvedValue(undefined);
    const { Wrapper, qc } = createHookWrapper();
    qc.setQueryData(['accounts'], [1]);
    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });
    result.current.mutate({ username: 'test', password: 'pass' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryData(['accounts'])).toBeUndefined();
    expect(spy).toHaveBeenCalled();
    expect(localStorage.getItem('cashctrl.cacheOwner')).toBe('test');
    spy.mockRestore();
  });

  it('conserve le cache quand le même utilisateur se reconnecte', async () => {
    localStorage.setItem('cashctrl.cacheOwner', 'test');
    const spy = vi.spyOn(queryPersister, 'removeClient').mockResolvedValue(undefined);
    const { Wrapper, qc } = createHookWrapper();
    qc.setQueryData(['accounts'], [1]);
    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });
    result.current.mutate({ username: 'test', password: 'pass' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryData(['accounts'])).toEqual([1]);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('useVerifyTotp réassigne le propriétaire du cache', async () => {
    localStorage.setItem('cashctrl.cacheOwner', 'alice');
    const spy = vi.spyOn(queryPersister, 'removeClient').mockResolvedValue(undefined);
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useVerifyTotp(), { wrapper: Wrapper });
    result.current.mutate({ code: '123456' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
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

describe('useSetupStatus', () => {
  it("indique si l'installation initiale est requise", async () => {
    server.use(http.get('/api/auth/setup', () => HttpResponse.json({ required: true })));
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useSetupStatus(true), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ required: true });
  });

  it('ne requête pas quand désactivé', () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useSetupStatus(false), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useSetup', () => {
  it('ouvre la session : injecte [me] et marque le setup comme fait', async () => {
    const { Wrapper, qc } = createHookWrapper();
    const { result } = renderHook(() => useSetup(), { wrapper: Wrapper });
    result.current.mutate({ token: 'T', username: 'owner', password: 'password123', lang: 'fr' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryData(['me'])).toMatchObject({ username: 'owner', isAdmin: true });
    expect(qc.getQueryData(['setup-status'])).toEqual({ required: false });
  });

  it('passe en erreur si le jeton est invalide', async () => {
    server.use(
      http.post('/api/auth/setup', () =>
        HttpResponse.json(
          { error: { code: 'auth.setup_token_invalid', message: 'Jeton invalide' } },
          { status: 403 },
        ),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useSetup(), { wrapper: Wrapper });
    result.current.mutate({ token: 'bad', username: 'owner', password: 'password123', lang: 'fr' });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateProfile', () => {
  it('met à jour le cache [me] avec le profil renvoyé', async () => {
    const { Wrapper, qc } = createHookWrapper();
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: Wrapper });
    result.current.mutate({ current_password: 'pw', username: 'nouveau', email: 'a@b.fr' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryData(['me'])).toEqual({ ...ME, username: 'nouveau', email: 'a@b.fr' });
  });

  it('passe en erreur si le mot de passe actuel est incorrect', async () => {
    server.use(
      http.patch('/api/auth/profile', () =>
        HttpResponse.json(
          { error: { code: 'auth.current_password_incorrect', message: 'Incorrect' } },
          { status: 401 },
        ),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: Wrapper });
    result.current.mutate({ current_password: 'bad', email: null });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useForgotPassword', () => {
  it('envoie la demande de réinitialisation', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useForgotPassword(), { wrapper: Wrapper });
    result.current.mutate({ identifier: 'alice', lang: 'en' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ ok: true });
  });
});

describe('useResetPassword', () => {
  it('réinitialise puis vide la session [me]', async () => {
    const { Wrapper, qc } = createHookWrapper();
    qc.setQueryData(['me'], ME);
    const spy = vi.spyOn(queryPersister, 'removeClient').mockResolvedValue(undefined);
    const { result } = renderHook(() => useResetPassword(), { wrapper: Wrapper });
    result.current.mutate({ token: 'abc', password: 'password123' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryData(['me'])).toBeNull();
    spy.mockRestore();
  });

  it('passe en erreur si le jeton est invalide', async () => {
    server.use(
      http.post('/api/auth/password/reset', () =>
        HttpResponse.json(
          { error: { code: 'auth.reset_token_invalid', message: 'Lien invalide' } },
          { status: 400 },
        ),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useResetPassword(), { wrapper: Wrapper });
    result.current.mutate({ token: 'bad', password: 'password123' });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('appareils mémorisés', () => {
  it('useVerifyTotp envoie remember', async () => {
    let body: unknown = null;
    server.use(
      http.post('/api/auth/2fa/verify', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...ME, totpEnabled: true });
      }),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useVerifyTotp(), { wrapper: Wrapper });
    result.current.mutate({ code: '123456', remember: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(body).toEqual({ code: '123456', remember: true });
  });

  it('useTrustedDevices charge la liste', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useTrustedDevices(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(TRUSTED_DEVICES);
  });

  it('useForgetDevice supprime un appareil et invalide la liste', async () => {
    let deletedId: string | undefined;
    server.use(
      http.delete('/api/auth/devices/:id', ({ params }) => {
        deletedId = params.id as string;
        return HttpResponse.json({ ok: true });
      }),
    );
    const { Wrapper, qc } = createHookWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useForgetDevice(), { wrapper: Wrapper });
    result.current.mutate(2);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deletedId).toBe('2');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.trustedDevices() });
  });

  it('useForgetAllDevices supprime tous les appareils et invalide la liste', async () => {
    let called = false;
    server.use(
      http.delete('/api/auth/devices', () => {
        called = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    const { Wrapper, qc } = createHookWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useForgetAllDevices(), { wrapper: Wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(called).toBe(true);
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.trustedDevices() });
  });

  it("l'activation et la désactivation de la 2FA invalident la liste", async () => {
    const { Wrapper, qc } = createHookWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const enable = renderHook(() => useEnable2FA(), { wrapper: Wrapper });
    enable.result.current.mutate({ code: '123456' });
    await waitFor(() => expect(enable.result.current.isSuccess).toBe(true));
    const disable = renderHook(() => useDisable2FA(), { wrapper: Wrapper });
    disable.result.current.mutate({ password: 'pw' });
    await waitFor(() => expect(disable.result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.trustedDevices() });
  });
});

describe('useSendTestEmail', () => {
  it("envoie l'e-mail de test", async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useSendTestEmail(), { wrapper: Wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('passe en erreur si le SMTP est absent', async () => {
    server.use(
      http.post('/api/auth/test-email', () =>
        HttpResponse.json(
          { error: { code: 'auth.smtp_not_configured', message: 'SMTP absent' } },
          { status: 503 },
        ),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useSendTestEmail(), { wrapper: Wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
