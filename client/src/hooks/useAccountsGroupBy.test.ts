import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setGroupBy, useAccountsGroupBy } from '@/hooks/useAccountsGroupBy.ts';

const KEY = 'cashctrl.accountsGroupBy';

beforeEach(() => {
  localStorage.clear();
  act(() => setGroupBy('bank'));
});

describe('useAccountsGroupBy', () => {
  it(`retourne "bank" par défaut`, () => {
    const { result } = renderHook(() => useAccountsGroupBy());
    expect(result.current).toBe('bank');
  });

  it('setGroupBy met à jour la valeur retournée', () => {
    const { result } = renderHook(() => useAccountsGroupBy());
    act(() => setGroupBy('type'));
    expect(result.current).toBe('type');
  });

  it('setGroupBy persiste dans localStorage', () => {
    renderHook(() => useAccountsGroupBy());
    act(() => setGroupBy('type'));
    expect(localStorage.getItem(KEY)).toBe('type');
  });

  it('retombe sur "bank" quand la valeur stockée est corrompue', async () => {
    localStorage.setItem(KEY, 'n-importe-quoi');
    vi.resetModules();
    const mod = await import('@/hooks/useAccountsGroupBy.ts');
    const { result } = renderHook(() => mod.useAccountsGroupBy());
    expect(result.current).toBe('bank');
    vi.resetModules();
  });

  it('notifie plusieurs abonnés simultanément', () => {
    const { result: r1 } = renderHook(() => useAccountsGroupBy());
    const { result: r2 } = renderHook(() => useAccountsGroupBy());
    act(() => setGroupBy('type'));
    expect(r1.current).toBe('type');
    expect(r2.current).toBe('type');
  });

  it('se désabonne proprement au démontage', () => {
    const { unmount } = renderHook(() => useAccountsGroupBy());
    unmount();
    expect(() => act(() => setGroupBy('type'))).not.toThrow();
  });

  it('ne plante pas au chargement du module quand localStorage.getItem lève', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.resetModules();
    const mod = await import('@/hooks/useAccountsGroupBy.ts');
    const { result } = renderHook(() => mod.useAccountsGroupBy());
    expect(result.current).toBe('bank');
    vi.restoreAllMocks();
    vi.resetModules();
  });
});
