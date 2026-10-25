import { describe, expect, it } from 'vitest';

import { parseSqliteUtc } from './dateUtils.js';

describe('parseSqliteUtc', () => {
  it("lit le format SQLite comme de l'UTC", () => {
    expect(parseSqliteUtc('2024-03-05 10:20:30').toISOString()).toBe('2024-03-05T10:20:30.000Z');
  });

  it("lit un format ISO sans fuseau comme de l'UTC", () => {
    expect(parseSqliteUtc('2024-03-05T10:20:30').toISOString()).toBe('2024-03-05T10:20:30.000Z');
  });

  it('conserve le suffixe Z', () => {
    expect(parseSqliteUtc('2024-03-05T10:20:30.123Z').toISOString()).toBe(
      '2024-03-05T10:20:30.123Z',
    );
  });

  it('respecte un offset explicite', () => {
    expect(parseSqliteUtc('2024-03-05T10:20:30+02:00').toISOString()).toBe(
      '2024-03-05T08:20:30.000Z',
    );
    expect(parseSqliteUtc('2024-03-05 10:20:30-05:00').toISOString()).toBe(
      '2024-03-05T15:20:30.000Z',
    );
  });
});
