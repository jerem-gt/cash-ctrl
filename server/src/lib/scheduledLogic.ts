import { ScheduledTransaction } from '../modules/scheduled/scheduled.types';

export function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00');
}

export function applyWeekend(d: Date, handling: 'allow' | 'before' | 'after'): Date {
  if (handling === 'allow') return d;
  const dow = d.getDay(); // 0=Sun, 6=Sat
  if (dow !== 0 && dow !== 6) return d;
  const result = new Date(d);
  if (handling === 'before') {
    result.setDate(d.getDate() - (dow === 6 ? 1 : 2));
  } else {
    result.setDate(d.getDate() + (dow === 6 ? 2 : 1));
  }
  return result;
}

export function getFirstOccurrence(sched: Pick<ScheduledTransaction,
  'start_date' | 'recurrence_unit' | 'recurrence_day' | 'recurrence_month'>
): Date {
  const start = parseDate(sched.start_date);

  if (sched.recurrence_unit === 'day' || sched.recurrence_unit === 'week') {
    return start;
  }

  if (sched.recurrence_unit === 'month') {
    const day = sched.recurrence_day ?? start.getDate();
    const candidate = new Date(start.getFullYear(), start.getMonth(), day);
    return candidate >= start
      ? candidate
      : new Date(start.getFullYear(), start.getMonth() + 1, day);
  }

  // year
  const day = sched.recurrence_day ?? start.getDate();
  const month = (sched.recurrence_month ?? start.getMonth() + 1) - 1;
  const candidate = new Date(start.getFullYear(), month, day);
  return candidate >= start
    ? candidate
    : new Date(start.getFullYear() + 1, month, day);
}

export function nextOccurrence(nominal: Date, sched: Pick<ScheduledTransaction,
  'recurrence_unit' | 'recurrence_interval' | 'recurrence_day' | 'recurrence_month'>
): Date {
  const { recurrence_unit: unit, recurrence_interval: interval } = sched;

  if (unit === 'day') {
    const d = new Date(nominal);
    d.setDate(d.getDate() + interval);
    return d;
  }

  if (unit === 'week') {
    const d = new Date(nominal);
    d.setDate(d.getDate() + interval * 7);
    return d;
  }

  if (unit === 'month') {
    const day = sched.recurrence_day ?? nominal.getDate();
    const nextMonth = new Date(nominal.getFullYear(), nominal.getMonth() + interval, 1);
    const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(day, lastDay));
  }

  // year
  const day = sched.recurrence_day ?? nominal.getDate();
  const month = (sched.recurrence_month ?? nominal.getMonth() + 1) - 1;
  const year = nominal.getFullYear() + interval;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}
