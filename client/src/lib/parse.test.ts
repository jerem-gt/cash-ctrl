import { describe, expect, it } from 'vitest';

import { parseAmountOrZero, parseIdOrNull, parseIdOrUndefined } from './parse';

describe('parseIdOrNull', () => {
  it('renvoie null pour string vide, null ou undefined', () => {
    expect(parseIdOrNull('')).toBeNull();
    expect(parseIdOrNull(null)).toBeNull();
    expect(parseIdOrNull(undefined)).toBeNull();
  });

  it('renvoie null pour string non parsable', () => {
    expect(parseIdOrNull('abc')).toBeNull();
    expect(parseIdOrNull('--')).toBeNull();
  });

  it('renvoie null pour "0" (id sentinelle)', () => {
    expect(parseIdOrNull('0')).toBeNull();
  });

  it('parse les ids entiers', () => {
    expect(parseIdOrNull('1')).toBe(1);
    expect(parseIdOrNull('42')).toBe(42);
    expect(parseIdOrNull('1000')).toBe(1000);
  });

  it('tronque les décimales (parseInt)', () => {
    expect(parseIdOrNull('1.5')).toBe(1);
    expect(parseIdOrNull('42.99')).toBe(42);
  });
});

describe('parseIdOrUndefined', () => {
  it('renvoie undefined au lieu de null', () => {
    expect(parseIdOrUndefined('')).toBeUndefined();
    expect(parseIdOrUndefined('0')).toBeUndefined();
    expect(parseIdOrUndefined('abc')).toBeUndefined();
  });

  it('parse les ids comme parseIdOrNull', () => {
    expect(parseIdOrUndefined('5')).toBe(5);
  });
});

describe('parseAmountOrZero', () => {
  it('renvoie 0 pour string vide, null ou undefined', () => {
    expect(parseAmountOrZero('')).toBe(0);
    expect(parseAmountOrZero(null)).toBe(0);
    expect(parseAmountOrZero(undefined)).toBe(0);
  });

  it('renvoie 0 pour string non parsable', () => {
    expect(parseAmountOrZero('abc')).toBe(0);
  });

  it('parse les nombres décimaux', () => {
    expect(parseAmountOrZero('1.5')).toBe(1.5);
    expect(parseAmountOrZero('42.99')).toBeCloseTo(42.99);
    expect(parseAmountOrZero('-3.14')).toBeCloseTo(-3.14);
  });

  it('parse les entiers', () => {
    expect(parseAmountOrZero('0')).toBe(0);
    expect(parseAmountOrZero('100')).toBe(100);
  });
});
