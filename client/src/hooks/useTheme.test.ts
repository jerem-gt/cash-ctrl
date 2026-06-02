import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'cashctrl.theme';

interface MockMql {
  matches: boolean;
  addEventListener: (type: string, cb: (e: MediaQueryListEvent) => void) => void;
  removeEventListener: (type: string, cb: (e: MediaQueryListEvent) => void) => void;
  emit: () => void;
}

let mql: MockMql;
let mod: typeof import('./useTheme');

function makeMql(): MockMql {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const m: MockMql = {
    matches: false,
    addEventListener: (_t, cb) => listeners.add(cb),
    removeEventListener: (_t, cb) => listeners.delete(cb),
    emit: () => {
      for (const cb of listeners) cb({ matches: m.matches } as MediaQueryListEvent);
    },
  };
  return m;
}

describe('useTheme store', () => {
  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    mql = makeMql();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mql),
    );
    // Module à état : ré-importer après reset pour repartir d'un store neuf.
    vi.resetModules();
    mod = await import('./useTheme');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    document.documentElement.classList.remove('dark');
  });

  it('défaut = "system" quand rien n\'est stocké', () => {
    const { result } = renderHook(() => mod.useTheme());
    expect(result.current).toBe('system');
  });

  it('setTheme("dark") applique .dark et persiste', () => {
    const { result } = renderHook(() => mod.useTheme());
    act(() => mod.setTheme('dark'));

    expect(result.current).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('dark');
  });

  it('setTheme("light") retire .dark et persiste', () => {
    const { result } = renderHook(() => mod.useTheme());
    act(() => mod.setTheme('light'));

    expect(result.current).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(KEY)).toBe('light');
  });

  it('setTheme("system") efface la clé et suit la préférence OS', () => {
    mql.matches = true;
    act(() => mod.setTheme('system'));

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('en mode système, réagit au changement de préférence OS', () => {
    const { result } = renderHook(() => mod.useIsDark());
    act(() => mod.setTheme('system'));
    expect(result.current).toBe(false);

    act(() => {
      mql.matches = true;
      mql.emit();
    });

    expect(result.current).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
