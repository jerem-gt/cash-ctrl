import type { Database } from 'better-sqlite3';

const DEFAULT_CATEGORIES = [
    { name: 'Alimentation', color: '#7DBB4A' },
    { name: 'Loyer',        color: '#4A90D9' },
    { name: 'Transport',    color: '#E8A030' },
    { name: 'Santé',        color: '#C966A0' },
    { name: 'Loisirs',      color: '#9B6DD6' },
    { name: 'Abonnements',  color: '#5BB8C4' },
    { name: 'Salaire',      color: '#2D8A50' },
    { name: 'Épargne',      color: '#4A7F5E' },
    { name: 'Transfert',    color: '#000000' },
    { name: 'Autre',        color: '#9E9A92' },
];

export function seedCategories(db: Database) {
    const stmt = db.prepare(`
    INSERT OR IGNORE INTO categories (name, color)
    VALUES (?, ?)
  `);

    db.transaction(() => {
        for (const c of DEFAULT_CATEGORIES) {
            stmt.run(c.name, c.color);
        }
    })();
}