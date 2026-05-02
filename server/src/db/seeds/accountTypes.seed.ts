import type { Database } from 'better-sqlite3';

const DEFAULT_ACCOUNT_TYPES = [
  { name: 'Courant', is_investment: 0 },
  { name: 'Épargne', is_investment: 0 },
  { name: 'Livret', is_investment: 0 },
  { name: 'Crédit', is_investment: 0 },
  { name: 'Bourse', is_investment: 1 },
  { name: 'Autre', is_investment: 0 },
];

export function seedAccountTypes(db: Database) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO account_types (name, is_investment) VALUES (?, ?)',
  );
  // Corrige les lignes déjà existantes (ex. migration depuis ancienne version)
  const update = db.prepare(
    'UPDATE account_types SET is_investment = ? WHERE name = ? AND is_investment != ?',
  );

  db.transaction(() => {
    for (const { name, is_investment } of DEFAULT_ACCOUNT_TYPES) {
      insert.run(name, is_investment);
      update.run(is_investment, name, is_investment);
    }
  })();
}
