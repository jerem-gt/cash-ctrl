import type { ScheduledTransaction } from '@cashctrl/types';
import type { useTranslation } from 'react-i18next';

export type TScheduled = ReturnType<typeof useTranslation<'scheduled'>>['t'];

function recurrenceLabelMonth(s: ScheduledTransaction, n: number, t: TScheduled): string {
  if (n === 1) {
    return s.recurrence_day
      ? t('recurrence.each_month_day', { day: s.recurrence_day })
      : t('recurrence.each_month');
  }
  return s.recurrence_day
    ? t('recurrence.every_n_months_day', { n, day: s.recurrence_day })
    : t('recurrence.every_n_months', { n });
}

function recurrenceLabelYear(s: ScheduledTransaction, n: number, t: TScheduled): string {
  const day = s.recurrence_day ?? '';
  const monthKeys = [
    t('months.1'),
    t('months.2'),
    t('months.3'),
    t('months.4'),
    t('months.5'),
    t('months.6'),
    t('months.7'),
    t('months.8'),
    t('months.9'),
    t('months.10'),
    t('months.11'),
    t('months.12'),
  ];
  const monthName = s.recurrence_month ? (monthKeys[s.recurrence_month - 1] ?? '') : '';
  if (day || monthName) {
    return n === 1
      ? t('recurrence.each_year_on', { day, month: monthName })
      : t('recurrence.every_n_years_on', { n, day, month: monthName });
  }
  return n === 1 ? t('recurrence.each_year') : t('recurrence.every_n_years', { n });
}

export function recurrenceLabel(s: ScheduledTransaction, t: TScheduled): string {
  const n = s.recurrence_interval;
  const unit = s.recurrence_unit;

  if (unit === 'day') {
    return n === 1 ? t('recurrence.each_day') : t('recurrence.every_n_days', { n });
  }
  if (unit === 'week') {
    return n === 1 ? t('recurrence.each_week') : t('recurrence.every_n_weeks', { n });
  }
  if (unit === 'month') {
    return recurrenceLabelMonth(s, n, t);
  }
  return recurrenceLabelYear(s, n, t);
}
