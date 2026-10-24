import { describe, expect, it } from 'vitest';

import { parseLocalDate } from './dateUtils';

// Fuseau fixé à Europe/Paris (vitest.config.ts) : ne discrimine pas les fuseaux à offset négatif (ex. America/New_York).
describe('parseLocalDate', () => {
  it('garde le jour local quel que soit le fuseau', () => {
    const d = parseLocalDate('2025-01-01');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2025, 0, 1]);
  });
});
