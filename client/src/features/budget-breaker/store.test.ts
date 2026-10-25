import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  setRemainingRatio,
  startBudgetBreaker,
  stopBudgetBreaker,
  useBudgetBreaker,
} from './store';

afterEach(() => {
  act(() => stopBudgetBreaker());
});

describe('store budget-breaker', () => {
  it('est inactif avec un ratio de 1 par défaut', () => {
    const { result } = renderHook(() => useBudgetBreaker());
    expect(result.current).toEqual({ active: false, remainingRatio: 1 });
  });

  it('démarre et met à jour le ratio restant', () => {
    const { result } = renderHook(() => useBudgetBreaker());
    act(() => startBudgetBreaker());
    expect(result.current.active).toBe(true);
    act(() => setRemainingRatio(0.4));
    expect(result.current.remainingRatio).toBeCloseTo(0.4);
  });

  it('borne le ratio entre 0 et 1', () => {
    const { result } = renderHook(() => useBudgetBreaker());
    act(() => setRemainingRatio(-2));
    expect(result.current.remainingRatio).toBe(0);
    act(() => setRemainingRatio(3));
    expect(result.current.remainingRatio).toBe(1);
  });

  it("remet le ratio à 1 à l'arrêt", () => {
    const { result } = renderHook(() => useBudgetBreaker());
    act(() => {
      startBudgetBreaker();
      setRemainingRatio(0.2);
    });
    act(() => stopBudgetBreaker());
    expect(result.current).toEqual({ active: false, remainingRatio: 1 });
  });
});
