import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createHookWrapper } from '@/tests/helpers/hookWrapper';

import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from './useCategories';

describe('useCategories', () => {
  it('charge les catégories', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCategories(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject([{ name: 'Alimentation' }, { name: 'Logement' }]);
  });
});

describe('useCreateCategory', () => {
  it('crée une catégorie avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCreateCategory(), { wrapper: Wrapper });
    result.current.mutate({ name: 'Loisirs', color: '#3b82f6', icon: '❓' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useUpdateCategory', () => {
  it('met à jour une catégorie avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useUpdateCategory(), { wrapper: Wrapper });
    result.current.mutate({ id: 1, name: 'Courses', color: '#22c55e', icon: '❓' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useDeleteCategory', () => {
  it('supprime une catégorie avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDeleteCategory(), { wrapper: Wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
