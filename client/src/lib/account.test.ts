import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { accountSeniority } from './account';

describe('accountSeniority', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25'));
  });
  afterEach(() => vi.useRealTimers());

  it('retourne "moins d\'un mois" pour le jour même', () => {
    expect(accountSeniority('2026-04-25')).toBe("moins d'un mois");
  });

  it('retourne "moins d\'un mois" si < 1 mois complet dans le même mois', () => {
    expect(accountSeniority('2026-04-01')).toBe("moins d'un mois");
  });

  it('retourne "moins d\'un mois" si le jour d\'ouverture > jour courant (mois non complet)', () => {
    // 25 < 26, donc on retire 1 mois → 0 mois
    expect(accountSeniority('2026-03-26')).toBe("moins d'un mois");
  });

  it('retourne "1 mois" pour exactement 1 mois', () => {
    expect(accountSeniority('2026-03-25')).toBe('1 mois');
  });

  it('retourne "N mois" pour plusieurs mois (même année)', () => {
    expect(accountSeniority('2026-02-25')).toBe('2 mois');
  });

  it('retourne "1 an" pour exactement 1 an', () => {
    expect(accountSeniority('2025-04-25')).toBe('1 an');
  });

  it('retourne "2 ans" pour exactement 2 ans', () => {
    expect(accountSeniority('2024-04-25')).toBe('2 ans');
  });

  it('retourne "1 an N mois" pour une ancienneté mixte', () => {
    expect(accountSeniority('2024-10-25')).toBe('1 an 6 mois');
  });

  it('retourne "N ans N mois" pour une longue ancienneté', () => {
    expect(accountSeniority('2023-01-25')).toBe('3 ans 3 mois');
  });
});
