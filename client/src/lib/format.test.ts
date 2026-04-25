import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fmt,
  fmtDate,
  fmtDateShort,
  fmtDec,
  isSameMonth,
  isThisMonth,
  monthLabel,
  today,
} from './format';

describe('fmt', () => {
  it('formate un entier positif en euros sans décimales', () => {
    const result = fmt(1234);
    expect(result).toMatch(/1.234/); // espace insécable ou normal selon ICU
    expect(result).toContain('€');
  });

  it('supprime les décimales', () => {
    expect(fmt(1234.9)).not.toContain(',');
    expect(fmt(1234.9)).toContain('€');
  });

  it('formate zéro', () => {
    expect(fmt(0)).toMatch(/0/);
    expect(fmt(0)).toContain('€');
  });

  it('formate un montant négatif', () => {
    const result = fmt(-50);
    expect(result).toContain('50');
    expect(result).toContain('€');
  });
});

describe('fmtDec', () => {
  it('inclut les centimes', () => {
    const result = fmtDec(24.5);
    expect(result).toMatch(/24/);
    expect(result).toMatch(/50/);
    expect(result).toContain('€');
  });

  it('affiche deux décimales pour un entier', () => {
    const result = fmtDec(100);
    expect(result).toMatch(/100/);
    expect(result).toContain('€');
  });
});

describe('fmtDate', () => {
  it('formate une date ISO en français avec jour, mois abrégé et année', () => {
    const result = fmtDate('2026-04-25');
    expect(result).toContain('25');
    expect(result).toContain('2026');
    expect(result).toMatch(/avr/i);
  });

  it('formate janvier', () => {
    const result = fmtDate('2026-01-15');
    expect(result).toContain('15');
    expect(result).toContain('2026');
    expect(result).toMatch(/jan/i);
  });
});

describe('fmtDateShort', () => {
  it("inclut le jour et le mois mais pas l'année", () => {
    const result = fmtDateShort('2026-04-25');
    expect(result).toContain('25');
    expect(result).not.toContain('2026');
    expect(result).toMatch(/avr/i);
  });
});

describe('today', () => {
  it('retourne une chaîne au format YYYY-MM-DD', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('correspond à la date du jour fixée', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25T10:00:00'));
    expect(today()).toBe('2026-04-25');
    vi.useRealTimers();
  });
});

describe('isThisMonth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25'));
  });
  afterEach(() => vi.useRealTimers());

  it('retourne true pour des dates du mois courant', () => {
    expect(isThisMonth('2026-04-01')).toBe(true);
    expect(isThisMonth('2026-04-25')).toBe(true);
  });

  it('retourne false pour le mois précédent', () => {
    expect(isThisMonth('2026-03-31')).toBe(false);
  });

  it('retourne false pour le même mois une autre année', () => {
    expect(isThisMonth('2025-04-15')).toBe(false);
  });
});

describe('monthLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25'));
  });
  afterEach(() => vi.useRealTimers());

  it('retourne le mois courant pour offset 0', () => {
    expect(monthLabel(0)).toMatch(/avr/i);
  });

  it('retourne le mois précédent pour offset 1', () => {
    expect(monthLabel(1)).toMatch(/mars/i);
  });

  it("gère le changement d'année (offset 4 depuis avril = décembre)", () => {
    expect(monthLabel(4)).toMatch(/déc/i);
  });
});

describe('isSameMonth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25'));
  });
  afterEach(() => vi.useRealTimers());

  it('retourne true pour le mois courant (offset 0)', () => {
    expect(isSameMonth('2026-04-10', 0)).toBe(true);
  });

  it('retourne true pour le mois précédent (offset 1)', () => {
    expect(isSameMonth('2026-03-15', 1)).toBe(true);
  });

  it("retourne false si la date ne correspond pas à l'offset", () => {
    expect(isSameMonth('2026-04-10', 1)).toBe(false);
    expect(isSameMonth('2026-02-10', 1)).toBe(false);
  });
});
