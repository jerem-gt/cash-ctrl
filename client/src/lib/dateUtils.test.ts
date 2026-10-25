import { afterEach, describe, expect, it, vi } from 'vitest';

import { addDays, formatLocalDate, parseSqliteUtc, sqliteUtcToLocalDate } from './dateUtils';

describe('parseSqliteUtc', () => {
  it("lit le format SQLite et l'ISO sans fuseau comme de l'UTC", () => {
    expect(parseSqliteUtc('2026-05-01 23:30:00').toISOString()).toBe('2026-05-01T23:30:00.000Z');
    expect(parseSqliteUtc('2026-05-01T23:30:00').toISOString()).toBe('2026-05-01T23:30:00.000Z');
  });

  it('respecte Z et les offsets explicites', () => {
    expect(parseSqliteUtc('2026-05-01T23:30:00Z').toISOString()).toBe('2026-05-01T23:30:00.000Z');
    expect(parseSqliteUtc('2026-05-01T23:30:00+02:00').toISOString()).toBe(
      '2026-05-01T21:30:00.000Z',
    );
  });
});

describe('sqliteUtcToLocalDate', () => {
  it('renvoie le jour local (Paris) quand le jour UTC est la veille', () => {
    expect(sqliteUtcToLocalDate('2026-05-01 23:30:00')).toBe('2026-05-02');
    expect(sqliteUtcToLocalDate('2026-05-01 10:00:00')).toBe('2026-05-01');
  });
});

describe('fuseau des tests', () => {
  it("est Europe/Paris (sinon les tests de changement d'heure passent à vide)", () => {
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-120);
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-60);
  });
});

describe('formatLocalDate', () => {
  it('formate en YYYY-MM-DD local avec padding', () => {
    expect(formatLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('addDays', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ajoute et retire un jour', () => {
    expect(addDays('2026-06-13', 1)).toBe('2026-06-14');
    expect(addDays('2026-06-13', -1)).toBe('2026-06-12');
  });

  it('gère la fin de mois', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it("gère la fin d'année", () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('gère le 29 février des années bissextiles', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });

  it("gère le passage à l'heure d'été (fin mars)", () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-03-30', -1)).toBe('2026-03-29');
  });

  it("gère le passage à l'heure d'hiver (fin octobre)", () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-10-26', -1)).toBe('2026-10-25');
  });

  it("part d'aujourd'hui si la valeur est vide ou invalide", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 13, 12, 0, 0));
    expect(addDays('', 1)).toBe('2026-06-14');
    expect(addDays('invalide', -1)).toBe('2026-06-12');
  });
});
