import { describe, expect, it } from 'vitest';

import { RecurrenceUnit, WeekendHandling } from '../constants';
import { dateStr } from './dateUtils';
import {
  applyWeekend,
  forEachOccurrence,
  getFirstOccurrence,
  nextOccurrence,
} from './scheduledLogic.js';

// Helper: build a minimal ScheduledTransaction-like object
function sched(
  unit: RecurrenceUnit,
  interval: number,
  startDate: string,
  opts: {
    recurrence_day?: number;
    recurrence_month?: number;
    weekend_handling?: WeekendHandling;
    end_date?: string | null;
  } = {},
) {
  return {
    start_date: startDate,
    recurrence_unit: unit,
    recurrence_interval: interval,
    recurrence_day: opts.recurrence_day ?? null,
    recurrence_month: opts.recurrence_month ?? null,
    weekend_handling: opts.weekend_handling ?? 'allow',
    end_date: opts.end_date ?? null,
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

// ─── forEachOccurrence : fast-forward vs itération naïve ──────────────────────

function naiveOccurrences(s: ReturnType<typeof sched>, from: Date, until: Date): string[] {
  const endDate = s.end_date ? new Date(`${s.end_date}T00:00:00`) : null;
  let nominal = getFirstOccurrence(s);
  const result: string[] = [];
  let guard = 0;
  while (nominal <= until && guard < 20000) {
    guard++;
    if (endDate && nominal > endDate) break;
    const actual = applyWeekend(nominal, s.weekend_handling);
    if (actual >= from && actual <= until) result.push(dateStr(actual));
    nominal = nextOccurrence(nominal, s);
  }
  return result;
}

function fastForwardOccurrences(s: ReturnType<typeof sched>, from: Date, until: Date): string[] {
  const result: string[] = [];
  forEachOccurrence(s, { from, until }, (actual) => {
    if (actual >= from && actual <= until) result.push(dateStr(actual));
  });
  return result;
}

describe('forEachOccurrence — fast-forward arithmétique vs itération naïve', () => {
  const cases: Array<{
    label: string;
    s: ReturnType<typeof sched>;
    from: string;
    until: string;
  }> = [
    {
      label: 'day, intervalle 3',
      s: sched('day', 3, '2015-01-01'),
      from: '2026-01-01',
      until: '2026-04-01',
    },
    {
      label: 'week, intervalle 2',
      s: sched('week', 2, '2015-01-06'),
      from: '2026-01-01',
      until: '2026-04-01',
    },
    {
      label: 'month, intervalle 1, ancre fin de mois (31)',
      s: sched('month', 1, '2015-01-31', { recurrence_day: 31 }),
      from: '2026-01-01',
      until: '2027-01-01',
    },
    {
      label: 'month, intervalle 5',
      s: sched('month', 5, '2015-03-15', { recurrence_day: 15 }),
      from: '2025-01-01',
      until: '2028-01-01',
    },
    {
      label: 'year, intervalle 1, ancre 29 fevrier',
      s: sched('year', 1, '2016-02-29', { recurrence_day: 29, recurrence_month: 2 }),
      from: '2023-01-01',
      until: '2030-01-01',
    },
    {
      label: 'year, intervalle 3',
      s: sched('year', 3, '2010-06-10', { recurrence_day: 10, recurrence_month: 6 }),
      from: '2024-01-01',
      until: '2040-01-01',
    },
    {
      label: 'day, weekend_handling after, from proche du samedi',
      s: sched('day', 1, '2015-01-01', { weekend_handling: 'after' }),
      from: '2026-04-04', // samedi
      until: '2026-04-10',
    },
    {
      label: 'month sans recurrence_day (jour dérivant) : fallback safe, résultat identique',
      s: sched('month', 1, '2015-01-31'),
      from: '2026-01-01',
      until: '2026-06-01',
    },
  ];

  it.each(cases)('$label : mêmes occurrences avec et sans fast-forward', ({ s, from, until }) => {
    const fromDate = new Date(`${from}T00:00:00`);
    const untilDate = new Date(`${until}T00:00:00`);
    expect(fastForwardOccurrences(s, fromDate, untilDate)).toEqual(
      naiveOccurrences(s, fromDate, untilDate),
    );
  });

  it('accélère réellement : peu de callbacks pour une planif quotidienne ancienne', () => {
    const s = sched('day', 1, '2015-01-01');
    const from = new Date('2026-01-01T00:00:00');
    const until = new Date('2026-01-10T00:00:00');
    let callbackCount = 0;
    forEachOccurrence(s, { from, until }, () => {
      callbackCount++;
    });
    // Sans fast-forward il faudrait ~4018 itérations (2015-01-01 → 2026-01-01) pour atteindre `from`.
    expect(callbackCount).toBeLessThan(20);
  });
});
