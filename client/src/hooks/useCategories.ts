import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { categoriesApi } from '@/api/client';
import { queryKeys } from '@/lib/queryKeys';
import type { Category } from '@/types';

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

const sortCategories = (cats: Category[]) =>
  [...cats].sort(byName).map((c) => ({ ...c, subcategories: [...c.subcategories].sort(byName) }));

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories(),
    queryFn: categoriesApi.list,
    select: sortCategories,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categories() }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number; name: string; icon: string }) =>
      categoriesApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categories() }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: categoriesApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categories() }),
  });
}
