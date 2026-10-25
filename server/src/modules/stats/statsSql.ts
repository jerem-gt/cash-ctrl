// Fragments SQL partagés par les stats : ils supposent que la table transactions est aliasée `t`.

export const EXCLUDE_INSURANCE_TX = `AND t.id NOT IN (
  SELECT transaction_id FROM insurance_operations WHERE transaction_id IS NOT NULL
)`;

export const EXCLUDE_STOCK_TX = `AND t.id NOT IN (
  SELECT transaction_id FROM stock_operations WHERE transaction_id IS NOT NULL
)`;

// Catégorie effective : les ventilations priment sur le subcategory_id de la transaction
export const EFFECTIVE_CATEGORY_JOIN = `
  LEFT JOIN transaction_splits ts ON ts.transaction_id = t.id
  LEFT JOIN subcategories sc ON COALESCE(ts.subcategory_id, t.subcategory_id) = sc.id
  LEFT JOIN categories c ON sc.category_id = c.id`;

export const EFFECTIVE_AMOUNT = 'COALESCE(ts.amount, t.amount)';

export const SUM_EFFECTIVE_AMOUNT = `SUM(${EFFECTIVE_AMOUNT})`;
