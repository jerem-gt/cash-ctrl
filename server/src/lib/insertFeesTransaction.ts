import type { Database } from 'better-sqlite3';

import { getSystemRefs } from './administrationDataConstants';

export function insertFeesTransaction(
  db: Database,
  userId: number,
  accountId: number | null,
  feesCents: number,
  description: string,
  date: string,
  subcategoryIdOverride?: number | null,
): number | null {
  if (feesCents <= 0 || accountId == null) return null;
  const refs = getSystemRefs(db, userId);
  const subcategoryId = subcategoryIdOverride ?? refs.bankFeesSubcategoryId ?? null;
  const paymentMethodId = refs.prelevementPaymentMethodId ?? null;
  const result = db
    .prepare(
      `INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, validated)
       VALUES (?, ?, 'expense', ?, ?, ?, ?, ?, 1)`,
    )
    .run(userId, accountId, feesCents, description, subcategoryId, date, paymentMethodId);
  return Number(result.lastInsertRowid);
}
