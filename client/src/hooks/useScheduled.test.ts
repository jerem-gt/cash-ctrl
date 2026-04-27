import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createHookWrapper } from '@/tests/helpers/hookWrapper';

import {
  useCreateScheduled,
  useDeleteScheduled,
  useScheduled,
  useUpdateScheduled,
} from './useScheduled';

const PAYLOAD = {
  account_id: 1,
  to_account_id: null,
  type: 'expense' as const,
  amount: 800,
  description: 'Loyer',
  subcategory_id: 1,
  payment_method_id: 1,
  notes: null,
  recurrence_unit: 'month' as const,
  recurrence_interval: 1,
  recurrence_day: 1,
  recurrence_month: null,
  weekend_handling: 'allow' as const,
  start_date: '2024-01-01',
  end_date: null,
  active: true,
};

describe('useScheduled', () => {
  it('charge les planifications', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useScheduled(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].description).toBe('Loyer');
  });
});

describe('useCreateScheduled', () => {
  it('crée une planification avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCreateScheduled(), { wrapper: Wrapper });
    result.current.mutate(PAYLOAD);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useUpdateScheduled', () => {
  it('met à jour une planification avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useUpdateScheduled(), { wrapper: Wrapper });
    result.current.mutate({ id: 1, ...PAYLOAD });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useDeleteScheduled', () => {
  it('supprime une planification avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDeleteScheduled(), { wrapper: Wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
