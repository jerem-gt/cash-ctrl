import { describe, expect, it } from 'vitest';

import { parseLocalDate } from './dateUtils';

// Pleinement discriminant avec TZ=America/New_York (impossible à forcer en worker thread).
describe('parseLocalDate', () => {
  it('garde le jour local quel que soit le fuseau', () => {
    const d = parseLocalDate('2025-01-01');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2025, 0, 1]);
  });
});
