import type { Database } from 'better-sqlite3';

const DEFAULT_ACCOUNT_TYPES = [
    'Courant',
    'Épargne',
    'Livret',
    'Crédit',
    'Autre',
];

export function seedAccountTypes(db: Database) {
    const stmt = db.prepare(`
    INSERT OR IGNORE INTO account_types (name)
    VALUES (?)
  `);

    db.transaction(() => {
        for (const name of DEFAULT_ACCOUNT_TYPES) {
            stmt.run(name);
        }
    })();
}