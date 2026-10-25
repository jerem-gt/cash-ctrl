import { describe, expect, it } from 'vitest';

import { toCents, toEuros } from './money';

describe('money', () => {
  it('toCents arrondit les flottants', () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(-12.34)).toBe(-1234);
    expect(toCents(0)).toBe(0);
  });

  it('toEuros convertit les centimes', () => {
    expect(toEuros(1234)).toBeCloseTo(12.34, 10);
    expect(toEuros(-5)).toBeCloseTo(-0.05, 10);
  });
});
