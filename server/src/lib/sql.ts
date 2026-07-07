// Sous-requête solde validé par compte, partagée par accounts.repo.ts / forecast.repo.ts /
// account-balance-history.repo.ts. Complète avec un filtre optionnel puis `GROUP BY account_id`.
export const VALIDATED_TX_SUM_SELECT =
  "SELECT account_id, SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS s FROM transactions WHERE validated = 1";
