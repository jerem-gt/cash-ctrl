import { describe, it, expect } from 'vitest';
import { applyWeekend, getFirstOccurrence, nextOccurrence, dateStr } from './scheduledLogic.js';

// Helper: build a minimal ScheduledTransaction-like object
function sched(
  unit: 'day' | 'week' | 'month' | 'year',
  interval: number,
  startDate: string,
  opts: { recurrence_day?: number; recurrence_month?: number } = {},
) {
  return {
    start_date: startDate,
    recurrence_unit: unit,
    recurrence_interval: interval,
    recurrence_day: opts.recurrence_day ?? null,
    recurrence_month: opts.recurrence_month ?? null,
  };
}

// ─── applyWeekend ─────────────────────────────────────────────────────────────

describe('applyWeekend', () => {
  // 2026-04-06 = Monday, 2026-04-04 = Saturday, 2026-04-05 = Sunday
  const sat = new Date('2026-04-04T00:00:00');
  const sun = new Date('2026-04-05T00:00:00');
  const mon = new Date('2026-04-06T00:00:00');

  it('allow: returns the same date', () => {
    expect(dateStr(applyWeekend(sat, 'allow'))).toBe('2026-04-04');
    expect(dateStr(applyWeekend(sun, 'allow'))).toBe('2026-04-05');
  });

  it('before: Saturday → Friday', () => {
    expect(dateStr(applyWeekend(sat, 'before'))).toBe('2026-04-03');
  });

  it('before: Sunday → Friday', () => {
    expect(dateStr(applyWeekend(sun, 'before'))).toBe('2026-04-03');
  });

  it('after: Saturday → Monday', () => {
    expect(dateStr(applyWeekend(sat, 'after'))).toBe('2026-04-06');
  });

  it('after: Sunday → Monday', () => {
    expect(dateStr(applyWeekend(sun, 'after'))).toBe('2026-04-06');
  });

  it('weekday: unchanged for any handling', () => {
    expect(dateStr(applyWeekend(mon, 'before'))).toBe('2026-04-06');
    expect(dateStr(applyWeekend(mon, 'after'))).toBe('2026-04-06');
  });
});

// ─── getFirstOccurrence ───────────────────────────────────────────────────────

describe('getFirstOccurrence', () => {
  it('day: returns start_date', () => {
    expect(dateStr(getFirstOccurrence(sched('day', 1, '2026-04-15')))).toBe('2026-04-15');
  });

  it('week: returns start_date', () => {
    expect(dateStr(getFirstOccurrence(sched('week', 2, '2026-04-15')))).toBe('2026-04-15');
  });

  it('month: recurrence_day in the future within same month', () => {
    // Start on the 5th, recurrence on the 20th → same month
    const s = sched('month', 1, '2026-04-05', { recurrence_day: 20 });
    expect(dateStr(getFirstOccurrence(s))).toBe('2026-04-20');
  });

  it('month: recurrence_day already passed → next month', () => {
    // Start on the 25th, recurrence on the 10th → next month
    const s = sched('month', 1, '2026-04-25', { recurrence_day: 10 });
    expect(dateStr(getFirstOccurrence(s))).toBe('2026-05-10');
  });

  it('month: no recurrence_day → uses start day', () => {
    const s = sched('month', 1, '2026-04-15');
    expect(dateStr(getFirstOccurrence(s))).toBe('2026-04-15');
  });

  it('year: recurrence_day+month in the future', () => {
    const s = sched('year', 1, '2026-01-01', { recurrence_day: 5, recurrence_month: 6 });
    expect(dateStr(getFirstOccurrence(s))).toBe('2026-06-05');
  });

  it('year: recurrence_day+month already passed → next year', () => {
    const s = sched('year', 1, '2026-07-01', { recurrence_day: 1, recurrence_month: 3 });
    expect(dateStr(getFirstOccurrence(s))).toBe('2027-03-01');
  });

  it('year: no recurrence fields → uses start day/month', () => {
    const s = sched('year', 1, '2026-04-15');
    expect(dateStr(getFirstOccurrence(s))).toBe('2026-04-15');
  });
});

// ─── nextOccurrence ───────────────────────────────────────────────────────────

describe('nextOccurrence', () => {
  it('day: adds interval days', () => {
    const from = new Date('2026-04-01T00:00:00');
    expect(dateStr(nextOccurrence(from, sched('day', 3, '2026-04-01')))).toBe('2026-04-04');
  });

  it('week: adds interval * 7 days', () => {
    const from = new Date('2026-04-01T00:00:00');
    expect(dateStr(nextOccurrence(from, sched('week', 2, '2026-04-01')))).toBe('2026-04-15');
  });

  it('month: adds interval months', () => {
    const from = new Date('2026-01-31T00:00:00');
    const s = sched('month', 1, '2026-01-31', { recurrence_day: 31 });
    // Feb has 28 days → clamp to 28
    expect(dateStr(nextOccurrence(from, s))).toBe('2026-02-28');
  });

  it('month: no day clamping needed', () => {
    const from = new Date('2026-04-05T00:00:00');
    const s = sched('month', 1, '2026-04-05', { recurrence_day: 5 });
    expect(dateStr(nextOccurrence(from, s))).toBe('2026-05-05');
  });

  it('month: interval > 1', () => {
    const from = new Date('2026-01-15T00:00:00');
    const s = sched('month', 3, '2026-01-15', { recurrence_day: 15 });
    expect(dateStr(nextOccurrence(from, s))).toBe('2026-04-15');
  });

  it('year: adds interval years', () => {
    const from = new Date('2026-03-01T00:00:00');
    const s = sched('year', 1, '2026-03-01', { recurrence_day: 1, recurrence_month: 3 });
    expect(dateStr(nextOccurrence(from, s))).toBe('2027-03-01');
  });

  it('year: Feb 29 in non-leap year → clamp to 28', () => {
    // 2024 is leap, 2025 is not
    const from = new Date('2024-02-29T00:00:00');
    const s = sched('year', 1, '2024-02-29', { recurrence_day: 29, recurrence_month: 2 });
    expect(dateStr(nextOccurrence(from, s))).toBe('2025-02-28');
  });
});
