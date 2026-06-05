import type { MetricTrend } from '@/components/ui/layout';
import { fmt } from '@/lib/format';

const FLAT_PCT: MetricTrend = { direction: 'flat', value: '0 %', positive: true };

/**
 * Variation % mois courant vs précédent.
 * `higherIsBetter` détermine si une hausse est favorable (revenus) ou non (dépenses).
 * Retourne undefined quand il n'y a pas de base de comparaison valide.
 */
export function pctTrend(
  current: number,
  prev: number,
  higherIsBetter: boolean,
): MetricTrend | undefined {
  if (prev === 0) {
    if (current === 0) return FLAT_PCT;
    return undefined;
  }
  const pct = ((current - prev) / Math.abs(prev)) * 100;
  const rounded = Math.round(pct);
  if (rounded === 0) return FLAT_PCT;
  return {
    direction: rounded > 0 ? 'up' : 'down',
    value: `${Math.abs(rounded)} %`,
    positive: pct > 0 === higherIsBetter,
  };
}

/**
 * Écart en valeur absolue (€) pour le bilan mensuel.
 * Un % serait trompeur si la base est négative.
 */
export function deltaTrend(current: number, prev: number): MetricTrend {
  const diff = current - prev;
  if (Math.round(diff) === 0) return { direction: 'flat', value: fmt(0), positive: true };
  return {
    direction: diff > 0 ? 'up' : 'down',
    value: fmt(Math.abs(diff)),
    positive: diff > 0,
  };
}
