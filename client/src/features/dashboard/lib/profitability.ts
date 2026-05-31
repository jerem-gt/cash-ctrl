import { type TFunction } from 'i18next';

type TDashboard = TFunction<'dashboard'>;

export function getGainColor(positive: boolean): string {
  return positive ? 'text-emerald-600' : 'text-red-600';
}

/**
 * Formate le rendement annualisé : `null` → "—", sinon "+12.3 %" / "-5.0 %".
 */
export function formatAnnualized(pct: number | null): string {
  if (pct === null) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)} %`;
}

const MS_PER_MONTH = 30.44 * 24 * 3600 * 1000;

/**
 * Calcule l'ancienneté d'un compte en mois entiers depuis sa date d'ouverture.
 * Utilisé par formatDuration et exposé pour les tests.
 */
export function totalMonthsSince(openingDate: string, now: number): number {
  return Math.floor((now - new Date(openingDate).getTime()) / MS_PER_MONTH);
}

/**
 * Formate une durée mois/années en passant par les clés i18n dashboard.
 * Couvre les 5 formes : <1an, exactement N an(s), N an(s) M mois.
 */
export function formatDuration(openingDate: string, now: number, t: TDashboard): string {
  const totalMonths = totalMonthsSince(openingDate, now);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return t('duration_months', { months });
  if (months === 0) {
    return years > 1 ? t('duration_years_plural', { years }) : t('duration_years', { years });
  }
  return years > 1
    ? t('duration_years_months_plural', { years, months })
    : t('duration_years_months', { years, months });
}
