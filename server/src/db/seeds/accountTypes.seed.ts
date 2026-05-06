import type { Database } from 'better-sqlite3';

const DEFAULT_ACCOUNT_TYPES = [
  { name: 'Courant', is_investment: 0, is_loan: 0 },
  { name: 'Épargne', is_investment: 0, is_loan: 0 },
  { name: 'Bourse', is_investment: 1, is_loan: 0 },
  { name: 'Prêt', is_investment: 0, is_loan: 1 },
  { name: 'Autre', is_investment: 0, is_loan: 0 },
];

export function seedAccountTypes(db: Database) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO account_types (name, is_investment, is_loan) VALUES (?, ?, ?)',
  );
  const update = db.prepare(
    'UPDATE account_types SET is_investment = ?, is_loan = ? WHERE name = ?',
  );

  db.transaction(() => {
    for (const { name, is_investment, is_loan } of DEFAULT_ACCOUNT_TYPES) {
      insert.run(name, is_investment, is_loan);
      update.run(is_investment, is_loan, name);
    }
  })();
}
