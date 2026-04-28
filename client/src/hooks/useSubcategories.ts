import { useMutation, useQueryClient } from '@tanstack/react-query';

import { subcategoriesApi } from '@/api/client';

export function useCreateSubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: subcategoriesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateSubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number; name: string }) =>
      subcategoriesApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteSubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: subcategoriesApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}
