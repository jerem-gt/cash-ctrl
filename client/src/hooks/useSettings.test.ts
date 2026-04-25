import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createHookWrapper } from '@/tests/helpers/hookWrapper';

import { useSettings, useUpdateSettings } from './useSettings';

describe('useSettings', () => {
  it('charge les paramètres', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useSettings(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.lead_days).toBe(3);
  });
});

describe('useUpdateSettings', () => {
  it('met à jour les paramètres et injecte dans le cache', async () => {
    const { Wrapper, qc } = createHookWrapper();
    const { result } = renderHook(() => useUpdateSettings(), { wrapper: Wrapper });
    result.current.mutate({ lead_days: 30 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryData(['settings'])).toEqual({ lead_days: 30 });
  });
});
