import { Database } from 'better-sqlite3';

export function getTransferIds(db: Database, userId: number) {
  const subcat = db
    .prepare(`SELECT id FROM subcategories WHERE name = 'Transfert' AND user_id = ?`)
    .get(userId) as { id: number } | undefined;
  const pm = db
    .prepare(`SELECT id FROM payment_methods WHERE name = 'Transfert' AND user_id = ?`)
    .get(userId) as { id: number } | undefined;
  return { subcategoryId: subcat?.id ?? undefined, paymentMethodId: pm?.id ?? undefined };
}

export function getAccountTypeIds(db: Database, userId: number) {
  const atPret = db
    .prepare(`SELECT id FROM account_types WHERE name = 'Prêt' AND user_id = ?`)
    .get(userId) as { id: number } | undefined;
  return { atPretId: atPret?.id ?? undefined };
}
