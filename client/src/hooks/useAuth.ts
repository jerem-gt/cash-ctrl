import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { MeData } from '@/api/client';
import { authApi } from '@/api/client';
import { showToast } from '@/components/ui';
import { queryKeys } from '@/lib/queryKeys';

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
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.login(username, password),
    onSuccess: (data) => {
      if (!data.totp_required) {
        qc.setQueryData(queryKeys.me(), data satisfies MeData);
      }
    },
  });
}

export function useVerifyTotp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pendingToken, code }: { pendingToken: string; code: string }) =>
      authApi.verifyTotp(pendingToken, code),
    onSuccess: (data) => qc.setQueryData(queryKeys.me(), data),
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
    onSuccess: () =>
      qc.setQueryData(queryKeys.me(), (old: MeData | null | undefined) =>
        old ? { ...old, totpEnabled: true } : old,
      ),
  });
}

export function useDisable2FA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ password }: { password: string }) => authApi.disable2fa(password),
    onSuccess: () =>
      qc.setQueryData(queryKeys.me(), (old: MeData | null | undefined) =>
        old ? { ...old, totpEnabled: false } : old,
      ),
  });
}
