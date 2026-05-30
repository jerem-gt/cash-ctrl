/**
 * Parse une string en id entier base 10.
 * Renvoie null si la string est vide, NaN, ou égale à 0
 * (qui sont tous des valeurs sentinelles "pas d'id").
 */
export function parseIdOrNull(s: string | null | undefined): number | null {
  if (s == null || s === '') return null;
  const n = Number.parseInt(s);
  if (Number.isNaN(n) || n === 0) return null;
  return n;
}

/**
 * Variante qui renvoie undefined plutôt que null.
 * Utile pour les payloads où le champ peut être omis.
 */
export function parseIdOrUndefined(s: string | null | undefined): number | undefined {
  const v = parseIdOrNull(s);
  return v === null ? undefined : v;
}

/**
 * Parse une string en nombre décimal.
 * Renvoie 0 si la string est vide ou NaN.
 */
export function parseAmountOrZero(s: string | null | undefined): number {
  if (s == null || s === '') return 0;
  const n = Number.parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}
