import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createHookWrapper } from '@/tests/helpers/hookWrapper';

import { useBackupList, useRunBackup } from './useBackup';

describe('useBackupList', () => {
  it('charge la liste des backups', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useBackupList(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data?.[0].filename).toBe('cashctrl-backup-2026-05-14T10-00-00.json');
  });
});

describe('useRunBackup', () => {
  it('déclenche un backup (skipped=false) et invalide backup-list + settings', async () => {
    const { Wrapper, qc } = createHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useRunBackup(), { wrapper: Wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.skipped).toBe(false);
    expect(result.current.data?.filename).toBe('cashctrl-backup-2026-05-14T10-30-00-000.json');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['backup-list'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['settings'] });
  });

  it('ne invalide pas backup-list si skipped=true', async () => {
    const { Wrapper, qc } = createHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useRunBackup(), { wrapper: Wrapper });
    // Override handler to return skipped
    const { server } = await import('@/tests/msw/server');
    const { http, HttpResponse } = await import('msw');
    server.use(
      http.post('/api/backup/run', () =>
        HttpResponse.json({ skipped: true, filename: null }, { status: 200 }),
      ),
    );
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.skipped).toBe(true);
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['backup-list'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['settings'] });
  });
});
