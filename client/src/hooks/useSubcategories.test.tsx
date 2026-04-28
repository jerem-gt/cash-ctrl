import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createHookWrapper } from '@/tests/helpers/hookWrapper';

import {
  useCreateSubcategory,
  useDeleteSubcategory,
  useUpdateSubcategory,
} from './useSubcategories';

describe('useCreateSubcategory', () => {
  it('crée une sous-catégorie avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCreateSubcategory(), { wrapper: Wrapper });

    result.current.mutate({ name: 'Restaurant', category_id: 1 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useUpdateSubcategory', () => {
  it('met à jour une sous-catégorie avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useUpdateSubcategory(), { wrapper: Wrapper });

    result.current.mutate({ id: 10, name: 'Supermarché' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useDeleteSubcategory', () => {
  it('supprime une sous-catégorie avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDeleteSubcategory(), { wrapper: Wrapper });

    result.current.mutate(10);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
