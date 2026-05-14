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
    expect(result.current.data?.backup_enabled).toBe(false);
    expect(result.current.data?.backup_frequency_h).toBe(24);
    expect(result.current.data?.backup_max_files).toBe(7);
    expect(result.current.data?.backup_last_at).toBeNull();
  });
});

describe('useUpdateSettings', () => {
  it('met à jour les paramètres et injecte dans le cache', async () => {
    const { Wrapper, qc } = createHookWrapper();
    const { result } = renderHook(() => useUpdateSettings(), { wrapper: Wrapper });
    result.current.mutate({
      lead_days: 30,
      backup_enabled: false,
      backup_frequency_h: 24,
      backup_max_files: 7,
      backup_last_at: null,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cached = qc.getQueryData(['settings']) as { lead_days: number };
    expect(cached.lead_days).toBe(30);
  });
});
