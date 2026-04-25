import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createHookWrapper } from '@/tests/helpers/hookWrapper';

import {
  useAccountTypes,
  useCreateAccountType,
  useDeleteAccountType,
  useUpdateAccountType,
} from './useAccountTypes';

describe('useAccountTypes', () => {
  it('charge les types de compte', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useAccountTypes(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe('Courant');
  });
});

describe('useCreateAccountType', () => {
  it('crée un type avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCreateAccountType(), { wrapper: Wrapper });
    result.current.mutate({ name: 'PEA' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useUpdateAccountType', () => {
  it('met à jour un type avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useUpdateAccountType(), { wrapper: Wrapper });
    result.current.mutate({ id: 1, name: 'Livret' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useDeleteAccountType', () => {
  it('supprime un type avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDeleteAccountType(), { wrapper: Wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
