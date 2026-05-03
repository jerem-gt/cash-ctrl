import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { setGroupBy, useAccountsGroupBy } from '@/hooks/useAccountsGroupBy.ts';

const KEY = 'cashctrl.accountsGroupBy';

beforeEach(() => {
  localStorage.clear();
  act(() => setGroupBy('bank'));
});

describe('useAccountsGroupBy', () => {
  it('retourne "bank" par défaut', () => {
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
});
