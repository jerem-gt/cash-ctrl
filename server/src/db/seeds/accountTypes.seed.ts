import type { Database } from 'better-sqlite3';

type AccountTypeDef = {
  name: string;
  is_investment: 0 | 1;
  is_loan: 0 | 1;
  envelope_type?: string | null;
};

const DEFAULT_ACCOUNT_TYPES: AccountTypeDef[] = [
  { name: 'Courant', is_investment: 0, is_loan: 0 },
  { name: 'Épargne', is_investment: 0, is_loan: 0 },
  { name: 'Bourse', is_investment: 1, is_loan: 0 },
  { name: 'Prêt', is_investment: 0, is_loan: 1 },
  { name: 'Autre', is_investment: 0, is_loan: 0 },
  { name: 'Assurance Vie', is_investment: 0, is_loan: 0, envelope_type: 'assurance_vie' },
  { name: 'PER', is_investment: 0, is_loan: 0, envelope_type: 'per' },
];

export function seedAccountTypes(db: Database, userId: number) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO account_types (user_id, name, is_investment, is_loan, envelope_type) VALUES (?, ?, ?, ?, ?)',
  );
  const update = db.prepare(
    'UPDATE account_types SET is_investment = ?, is_loan = ?, envelope_type = ? WHERE name = ? AND user_id = ?',
  );

  db.transaction(() => {
    for (const { name, is_investment, is_loan, envelope_type = null } of DEFAULT_ACCOUNT_TYPES) {
      insert.run(userId, name, is_investment, is_loan, envelope_type);
      update.run(is_investment, is_loan, envelope_type, name, userId);
    }
  })();
}
