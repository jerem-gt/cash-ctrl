import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usersApi } from '@/api/client';
import { queryKeys } from '@/lib/queryKeys';

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users(),
    queryFn: usersApi.list,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { username: string; password: string; lang: 'fr' | 'en' }) =>
      usersApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users() }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number; username?: string; password?: string }) =>
      usersApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users() }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users() }),
  });
}
