// Sous-requête solde validé par compte, partagée par accounts.repo.ts / forecast.repo.ts /
// account-balance-history.repo.ts. Complète avec un filtre optionnel puis `GROUP BY account_id`.
export const VALIDATED_TX_SUM_SELECT =
  "SELECT account_id, SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS s FROM transactions WHERE validated = 1";

/** Échappe `\`, `%` et `_` pour un usage sûr dans un motif LIKE (ESCAPE '\'). */
export function escapeLikeTerm(term: string): string {
  return term
    .replaceAll('\\', String.raw`\\`)
    .replaceAll('%', String.raw`\%`)
    .replaceAll('_', String.raw`\_`);
}

/** Condition LIKE insensible accents/casse sur `column`, paramétrée par `:param` (déjà échappé via escapeLikeTerm). */
export function likeUnaccent(column: string, param = 'q'): string {
  return String.raw`unaccent(lower(${column})) LIKE '%' || unaccent(lower(:${param})) || '%' ESCAPE '\'`;
}
