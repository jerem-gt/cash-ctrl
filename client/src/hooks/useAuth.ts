import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { Lang, MeData } from '@/api/client';
import { authApi } from '@/api/client';
import { showToast } from '@/components/ui';
import { fireAndForget } from '@/lib/async';
import { queryKeys } from '@/lib/queryKeys';
import { claimCacheOwner, purgePersistedCache } from '@/lib/queryPersister';

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: authApi.me,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    meta: { suppressGlobalError: true },
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.login(username, password),
    onSuccess: (data) => {
      if (!data.totp_required) {
        claimCacheOwner(qc, data.username);
        qc.setQueryData(queryKeys.me(), data satisfies MeData);
      }
    },
  });
}

export function useVerifyTotp() {
  const qc = useQueryClient();
  return useMutation({
    meta: { suppressGlobalError: true },
    mutationFn: ({ code, remember }: { code: string; remember?: boolean }) =>
      authApi.verifyTotp(code, remember),
    onSuccess: (data) => {
      claimCacheOwner(qc, data.username);
      qc.setQueryData(queryKeys.me(), data);
    },
  });
}

export function useLogout() {
  const { t } = useTranslation('sidebar');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      showToast(t('logout_success'));
      qc.setQueryData(queryKeys.me(), null);
      qc.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' });
      purgePersistedCache();
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      authApi.changePassword(current, next),
  });
}

export function useSetup2FA() {
  return useMutation({ mutationFn: authApi.setup2fa });
}

export function useEnable2FA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ secret, code }: { secret: string; code: string }) =>
      authApi.enable2fa(secret, code),
    onSuccess: () => {
      qc.setQueryData(queryKeys.me(), (old: MeData | null | undefined) =>
        old ? { ...old, totpEnabled: true } : old,
      );
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.trustedDevices() }));
    },
  });
}

export function useDisable2FA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ password }: { password: string }) => authApi.disable2fa(password),
    onSuccess: () => {
      qc.setQueryData(queryKeys.me(), (old: MeData | null | undefined) =>
        old ? { ...old, totpEnabled: false } : old,
      );
      fireAndForget(qc.invalidateQueries({ queryKey: queryKeys.trustedDevices() }));
    },
  });
}

export function useTrustedDevices(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.trustedDevices(),
    queryFn: authApi.devices,
    enabled,
  });
}

export function useForgetDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.forgetDevice,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.trustedDevices() }),
  });
}

export function useForgetAllDevices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.forgetAllDevices,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.trustedDevices() }),
  });
}

export function useSetupStatus(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.setupStatus(),
    queryFn: authApi.setupStatus,
    enabled,
    retry: false,
  });
}

export function useSetup() {
  const qc = useQueryClient();
  return useMutation({
    meta: { suppressGlobalError: true },
    mutationFn: authApi.setup,
    onSuccess: (data) => {
      claimCacheOwner(qc, data.username);
      qc.setQueryData(queryKeys.setupStatus(), { required: false });
      qc.setQueryData(queryKeys.me(), data);
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (data) => {
      claimCacheOwner(qc, data.username);
      qc.setQueryData(queryKeys.me(), data);
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    meta: { suppressGlobalError: true },
    mutationFn: ({ identifier, lang }: { identifier: string; lang: Lang }) =>
      authApi.forgotPassword(identifier, lang),
  });
}

export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation({
    meta: { suppressGlobalError: true },
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      authApi.resetPassword(token, password),
    // La réinitialisation ferme toutes les sessions
    onSuccess: () => {
      qc.setQueryData(queryKeys.me(), null);
      qc.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.me()[0] });
      purgePersistedCache();
    },
  });
}

export function useSendTestEmail() {
  return useMutation({ mutationFn: authApi.testEmail });
}
