import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createHookWrapper } from '@/tests/helpers/hookWrapper';

import {
  useCreatePaymentMethod,
  useDeletePaymentMethod,
  usePaymentMethods,
  useUpdatePaymentMethod,
} from './usePaymentMethods';

describe('usePaymentMethods', () => {
  it('charge les moyens de paiement', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => usePaymentMethods(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe('CB');
  });
});

describe('useCreatePaymentMethod', () => {
  it('crée un moyen de paiement avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCreatePaymentMethod(), { wrapper: Wrapper });
    result.current.mutate({ name: 'Espèces', icon: '💵' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useUpdatePaymentMethod', () => {
  it('met à jour un moyen de paiement avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useUpdatePaymentMethod(), { wrapper: Wrapper });
    result.current.mutate({ id: 1, name: 'CB', icon: '💳' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useDeletePaymentMethod', () => {
  it('supprime un moyen de paiement avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDeletePaymentMethod(), { wrapper: Wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
