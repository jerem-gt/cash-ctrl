import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createHookWrapper } from '@/tests/helpers/hookWrapper';

import { useBanks, useCreateBank, useDeleteBank, useUpdateBank } from './useBanks';

describe('useBanks', () => {
  it('charge les banques', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useBanks(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe('BNP');
  });
});

describe('useCreateBank', () => {
  it('crée une banque avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCreateBank(), { wrapper: Wrapper });
    result.current.mutate({ name: 'Société Générale' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useUpdateBank', () => {
  it('met à jour une banque avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useUpdateBank(), { wrapper: Wrapper });
    result.current.mutate({ id: 1, name: 'BNP Paribas', domain: 'bnpparibas.fr' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useDeleteBank', () => {
  it('supprime une banque avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDeleteBank(), { wrapper: Wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
