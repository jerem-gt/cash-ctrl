import { describe, expect, it } from 'vitest';

import { BEST_KEY, MIN_RECORD_PLAY_SECONDS, readBest, settleRun } from './record';

describe('readBest', () => {
  it('retourne 0 sans valeur ou avec une valeur invalide', () => {
    expect(readBest()).toBe(0);
    for (const bad of ['abc', '-5', 'NaN', 'Infinity', '']) {
      localStorage.setItem(BEST_KEY, bad);
      expect(readBest()).toBe(0);
    }
  });

  it('lit un record valide', () => {
    localStorage.setItem(BEST_KEY, '1200');
    expect(readBest()).toBe(1200);
  });
});

describe('settleRun', () => {
  it("n'enregistre pas une partie trop courte", () => {
    const out = settleRun(900, MIN_RECORD_PLAY_SECONDS - 0.1);
    expect(out).toEqual({ newRecord: false, best: 0 });
    expect(localStorage.getItem(BEST_KEY)).toBeNull();
  });

  it('enregistre une partie assez longue qui bat le record', () => {
    localStorage.setItem(BEST_KEY, '100');
    const out = settleRun(900, MIN_RECORD_PLAY_SECONDS);
    expect(out).toEqual({ newRecord: true, best: 900 });
    expect(localStorage.getItem(BEST_KEY)).toBe('900');
  });

  it('conserve le record quand il est supérieur', () => {
    localStorage.setItem(BEST_KEY, '5000');
    expect(settleRun(900, 60)).toEqual({ newRecord: false, best: 5000 });
    expect(localStorage.getItem(BEST_KEY)).toBe('5000');
  });
});
