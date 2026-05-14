import type { Database } from 'better-sqlite3';

type AccountTypeDef = {
  name: string;
  envelope_type?: string | null;
};

const DEFAULT_ACCOUNT_TYPES: AccountTypeDef[] = [
  { name: 'Courant' },
  { name: 'Épargne' },
  { name: 'Bourse', envelope_type: 'investment' },
  { name: 'Prêt', envelope_type: 'loan' },
  { name: 'Autre' },
  { name: 'Assurance Vie', envelope_type: 'life_insurance' },
  { name: 'PER', envelope_type: 'per' },
];

export function seedAccountTypes(db: Database, userId: number) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO account_types (user_id, name, envelope_type) VALUES (?, ?, ?)',
  );
  const update = db.prepare(
    'UPDATE account_types SET envelope_type = ? WHERE name = ? AND user_id = ?',
  );

  db.transaction(() => {
    for (const { name, envelope_type = null } of DEFAULT_ACCOUNT_TYPES) {
      insert.run(userId, name, envelope_type);
      update.run(envelope_type, name, userId);
    }
  })();
}
