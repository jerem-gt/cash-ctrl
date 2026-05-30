import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedSync } from './useDebouncedSync';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedSync', () => {
  it("n'appelle pas onChange immédiatement", () => {
    const onChange = vi.fn();
    renderHook(() => useDebouncedSync('hello', (s) => s, '', onChange, 300));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('appelle onChange après le délai si la valeur dérivée diffère', () => {
    const onChange = vi.fn();
    renderHook(() => useDebouncedSync('hello', (s) => s, '', onChange, 300));
    void act(() => vi.advanceTimersByTime(300));
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it("n'appelle pas onChange si la valeur dérivée est égale à currentValue", () => {
    const onChange = vi.fn();
    renderHook(() => useDebouncedSync('hello', (s) => s, 'hello', onChange, 300));
    void act(() => vi.advanceTimersByTime(300));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reset le timer si localValue change avant le délai', () => {
    const onChange = vi.fn();
    const { rerender } = renderHook(
      ({ v }: { v: string }) => useDebouncedSync(v, (s) => s, '', onChange, 300),
      { initialProps: { v: 'a' } },
    );
    void act(() => vi.advanceTimersByTime(200));
    rerender({ v: 'ab' });
    void act(() => vi.advanceTimersByTime(200));
    expect(onChange).not.toHaveBeenCalled();
    void act(() => vi.advanceTimersByTime(100));
    expect(onChange).toHaveBeenCalledWith('ab');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('applique la transformation derive (trim + undefined)', () => {
    const onChange = vi.fn();
    renderHook(() =>
      useDebouncedSync(
        '  ',
        (s) => s.trim() || undefined,
        undefined as string | undefined,
        onChange,
        300,
      ),
    );
    void act(() => vi.advanceTimersByTime(300));
    expect(onChange).not.toHaveBeenCalled();

    onChange.mockClear();
    renderHook(() =>
      useDebouncedSync(
        '  hello  ',
        (s) => s.trim() || undefined,
        undefined as string | undefined,
        onChange,
        300,
      ),
    );
    void act(() => vi.advanceTimersByTime(300));
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('utilise toujours la dernière onChange (ref-based)', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const { rerender } = renderHook(
      ({ cb }: { cb: (v: string) => void }) => useDebouncedSync('hello', (s) => s, '', cb, 300),
      { initialProps: { cb: cb1 } },
    );
    rerender({ cb: cb2 });
    void act(() => vi.advanceTimersByTime(300));
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledWith('hello');
  });
});
