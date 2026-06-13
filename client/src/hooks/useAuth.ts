import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

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
