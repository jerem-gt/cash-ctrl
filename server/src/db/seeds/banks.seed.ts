import type { Database } from 'better-sqlite3';

const DEFAULT_BANKS: { name: string; domain: string }[] = [
    { name: 'BoursoBank',        domain: 'boursobank.com' },
    { name: 'Fortuneo',          domain: 'fortuneo.fr' },
    { name: 'Crédit Agricole',   domain: 'credit-agricole.fr' },
    { name: 'Linxea',            domain: 'linxea.com' },
    { name: 'Amundi',            domain: 'amundi.com' },
    { name: 'BNP Paribas',       domain: 'bnpparibas.com' },
    { name: 'Société Générale',  domain: 'societegenerale.com' },
    { name: 'Revolut',           domain: 'revolut.com' },
    { name: 'N26',               domain: 'n26.com' },
];

export function seedBanks(db: Database) {
    const stmt = db.prepare(`
    INSERT OR IGNORE INTO banks (name, logo, domain)
    VALUES (?, NULL, ?)
  `);

    db.transaction(() => {
        for (const { name, domain } of DEFAULT_BANKS) {
            stmt.run(name, domain);
        }
    })();
}
