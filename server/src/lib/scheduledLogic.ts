import { WeekendHandling } from '../constants.js';
import { ScheduledTransaction } from '../modules/scheduled/scheduled.types.js';
import { parseDate } from './dateUtils.js';

// Sécurité anti-boucle infinie si une planif est mal formée (récurrence figée, etc.)
export const MAX_OCCURRENCE_ITERATIONS = 10000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function applyWeekend(d: Date, handling: WeekendHandling): Date {
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

export function getFirstOccurrence(
  sched: Pick<
    ScheduledTransaction,
    'start_date' | 'recurrence_unit' | 'recurrence_day' | 'recurrence_month'
  >,
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
  return candidate >= start ? candidate : new Date(start.getFullYear() + 1, month, day);
}

export function nextOccurrence(
  nominal: Date,
  sched: Pick<
    ScheduledTransaction,
    'recurrence_unit' | 'recurrence_interval' | 'recurrence_day' | 'recurrence_month'
  >,
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

type OccurrenceSchedule = Pick<
  ScheduledTransaction,
  | 'start_date'
  | 'recurrence_unit'
  | 'recurrence_interval'
  | 'recurrence_day'
  | 'recurrence_month'
  | 'weekend_handling'
  | 'end_date'
>;

/**
 * Avance `nominal` au plus près de `target` sans le dépasser, par calcul arithmétique plutôt
 * qu'itération occurrence par occurrence. Exact pour day/week (pas de dérive possible). Pour
 * month/year, seulement si recurrence_day est fixe (sinon le jour dérive selon les mois
 * traversés, cf. nextOccurrence) et avec une marge d'un intervalle de sécurité : le résultat
 * reste toujours <= target, quitte à laisser le while loop de forEachOccurrence finir
 * l'approche via les derniers appels nextOccurrence normaux.
 */
function fastForwardOccurrence(
  nominal: Date,
  sched: Pick<OccurrenceSchedule, 'recurrence_unit' | 'recurrence_interval' | 'recurrence_day'>,
  target: Date,
): Date {
  if (target <= nominal) return nominal;
  const { recurrence_unit: unit, recurrence_interval: interval, recurrence_day } = sched;

  if (unit === 'day' || unit === 'week') {
    const stepDays = unit === 'day' ? interval : interval * 7;
    const steps = Math.floor((target.getTime() - nominal.getTime()) / MS_PER_DAY / stepDays);
    if (steps <= 0) return nominal;
    const d = new Date(nominal);
    d.setDate(d.getDate() + steps * stepDays);
    return d;
  }

  // Jour du mois non fixe : le jour peut dériver au fil des mois traversés (cf. nextOccurrence) → pas d'accélération.
  if (recurrence_day == null) return nominal;

  if (unit === 'month') {
    const monthsDiff =
      (target.getFullYear() - nominal.getFullYear()) * 12 +
      (target.getMonth() - nominal.getMonth());
    const steps = Math.floor(monthsDiff / interval) - 1;
    if (steps <= 0) return nominal;
    const base = new Date(nominal.getFullYear(), nominal.getMonth() + steps * interval, 1);
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    return new Date(base.getFullYear(), base.getMonth(), Math.min(recurrence_day, lastDay));
  }

  // year
  const steps = Math.floor((target.getFullYear() - nominal.getFullYear()) / interval) - 1;
  if (steps <= 0) return nominal;
  const year = nominal.getFullYear() + steps * interval;
  const lastDay = new Date(year, nominal.getMonth() + 1, 0).getDate();
  return new Date(year, nominal.getMonth(), Math.min(recurrence_day, lastDay));
}

export interface OccurrenceRange {
  /** Occurrences dont le nominal est avant `from` sautées quand c'est sûr arithmétiquement (best-effort). */
  from?: Date;
  /** Borne haute : on itère tant que nominal <= until. */
  until: Date;
  /** Reprise depuis la dernière génération : repart à l'occurrence suivant `resumeFrom`. */
  resumeFrom?: string | null;
}

/** Itère les occurrences d'une planif sur une plage donnée. Partagé par generateScheduled.ts et forecast.repo.ts. */
export function forEachOccurrence(
  sched: OccurrenceSchedule,
  range: OccurrenceRange,
  cb: (actual: Date, nominal: Date) => void,
): void {
  const endDate = sched.end_date ? parseDate(sched.end_date) : null;

  let nominal: Date;
  if (range.resumeFrom) {
    nominal = nextOccurrence(parseDate(range.resumeFrom), sched);
  } else {
    nominal = getFirstOccurrence(sched);
    if (range.from) nominal = fastForwardOccurrence(nominal, sched, range.from);
  }

  let iterations = 0;
  while (nominal <= range.until && iterations < MAX_OCCURRENCE_ITERATIONS) {
    iterations++;
    if (endDate && nominal > endDate) break;

    const actual = applyWeekend(nominal, sched.weekend_handling);
    cb(actual, nominal);

    nominal = nextOccurrence(nominal, sched);
  }
}
