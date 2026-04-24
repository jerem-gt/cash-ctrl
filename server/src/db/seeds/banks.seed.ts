import type { Database } from 'better-sqlite3';

const DEFAULT_BANKS = [
    'BoursoBank',
    'Fortuneo',
    'Crédit Agricole',
    'Linxea',
    'Amundi',
    'BNP Paribas',
    'Société Générale',
    'Revolut',
    'N26',
];

export function seedBanks(db: Database) {
    const stmt = db.prepare(`
    INSERT OR IGNORE INTO banks (name, logo)
    VALUES (?, NULL)
  `);

    db.transaction(() => {
        for (const name of DEFAULT_BANKS) {
            stmt.run(name);
        }
    })();
}