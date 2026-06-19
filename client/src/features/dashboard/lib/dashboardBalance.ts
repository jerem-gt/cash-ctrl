import type { BalanceHistoryData } from '@cashctrl/types';

export interface EnrichedBalance {
  types: string[];
  dataWithTotal: Array<Record<string, string | number>>;
  negativeTypes: Set<string>;
  lastPositiveType: string | undefined;
  hasLoans: boolean;
}

/**
 * Pré-calcule les méta-infos nécessaires au PatrimonyBarChart à partir
 * d'un BalanceHistoryData brut (ou undefined si la query n'a pas chargé).
 *
 * - `negativeTypes` : types qui contiennent au moins un point négatif (prêts en règle générale).
 * - `lastPositiveType` : dernier type non-négatif (utilisé pour le radius arrondi du chart).
 * - `dataWithTotal` : data enrichi du champ `_total` par mois (pour l'affichage agrégé).
 * - `hasLoans` : flag indiquant la présence d'un type 'prets' avec valeur < 0.
 */
export function enrichBalanceHistory(history: BalanceHistoryData | undefined): EnrichedBalance {
  const types = history?.account_types ?? [];
  const data = history?.data ?? [];
  const negativeTypes = new Set(types.filter((t) => data.some((d) => Number(d[t] ?? 0) < 0)));
  const lastPositiveType = types.findLast((t) => !negativeTypes.has(t));
  const dataWithTotal = data.map((d) => ({
    ...d,
    _total: types.reduce((s, t) => s + Number(d[t] ?? 0), 0),
  }));
  const hasLoans = data.some((d) => Number(d['prets'] ?? 0) < 0);
  return { types, dataWithTotal, negativeTypes, lastPositiveType, hasLoans };
}
