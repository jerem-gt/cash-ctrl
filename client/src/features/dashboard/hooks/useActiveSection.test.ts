import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useActiveSection } from './useActiveSection';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useActiveSection', () => {
  it('retourne null quand ids est vide', () => {
    const { result } = renderHook(() => useActiveSection([]));
    expect(result.current).toBeNull();
  });

  it('retourne le premier id initialement', () => {
    const { result } = renderHook(() => useActiveSection(['intro', 'details', 'footer']));
    expect(result.current).toBe('intro');
  });

  it("n'attache pas de listener scroll quand ids est vide", () => {
    const spy = vi.spyOn(globalThis, 'addEventListener');
    renderHook(() => useActiveSection([]));
    expect(spy).not.toHaveBeenCalledWith('scroll', expect.any(Function), expect.anything());
  });

  it('attache un listener scroll passif et le détache au démontage', () => {
    const addSpy = vi.spyOn(globalThis, 'addEventListener');
    const removeSpy = vi.spyOn(globalThis, 'removeEventListener');

    const { unmount } = renderHook(() => useActiveSection(['section-a']));

    expect(addSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('ne ré-enregistre pas le listener si le contenu des ids est inchangé', () => {
    const addSpy = vi.spyOn(globalThis, 'addEventListener');
    let ids = ['a', 'b'];
    const { rerender } = renderHook(() => useActiveSection(ids));
    const callCount = addSpy.mock.calls.filter(([e]) => e === 'scroll').length;
    // Nouveau tableau, même contenu → pas de ré-abonnement
    ids = ['a', 'b'];
    rerender();
    expect(addSpy.mock.calls.filter(([e]) => e === 'scroll').length).toBe(callCount);
  });

  it('met à jour la section active lors du scroll', () => {
    const el = document.createElement('div');
    el.id = 'target';
    document.body.appendChild(el);

    const { result } = renderHook(() => useActiveSection(['target'], 0));

    act(() => {
      globalThis.dispatchEvent(new Event('scroll'));
    });

    // jsdom: getBoundingClientRect().top = 0, window.scrollY = 0, offset = 0 → top(0) <= threshold(0)
    expect(result.current).toBe('target');
    document.body.removeChild(el);
  });
});
