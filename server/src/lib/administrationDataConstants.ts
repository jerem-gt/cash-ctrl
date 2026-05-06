import { Database } from 'better-sqlite3';

export function getTransferIds(db: Database) {
  const subcat = db.prepare(`SELECT id FROM subcategories WHERE name = 'Transfert'`).get() as
    | { id: number }
    | undefined;
  const pm = db.prepare(`SELECT id FROM payment_methods WHERE name = 'Transfert'`).get() as
    | { id: number }
    | undefined;
  return { subcategoryId: subcat?.id ?? undefined, paymentMethodId: pm?.id ?? undefined };
}

export function getAccountTypeIds(db: Database) {
  const atPret = db.prepare(`SELECT id FROM account_types WHERE name = 'Prêt'`).get() as
    | { id: number }
    | undefined;
  return { atPretId: atPret?.id ?? undefined };
}
