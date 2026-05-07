import type { Database } from 'better-sqlite3';

const DEFAULT_CATEGORIES = [
  { name: 'Logement', icon: '🏠' },
  { name: 'Automobile', icon: '🚗' },
  { name: 'Transports en commun', icon: '🚌' },
  { name: 'Santé', icon: '⚕️' },
  { name: 'Alimentation', icon: '🍴' },
  { name: 'Vie quotidienne', icon: '🛍️' },
  { name: 'Loisirs', icon: '🎮' },
  { name: 'Impôts', icon: '💸' },

  { name: 'Revenus du travail', icon: '💼' },
  { name: 'Prestations sociales', icon: '🏦' },
  { name: 'Revenus financiers', icon: '📈' },
  { name: 'Revenus divers', icon: '💰' },

  { name: 'Transfert', icon: '🔄' },
  { name: 'Autre', icon: '❓' },
];

export function seedCategories(db: Database, userId: number) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO categories (user_id, name, icon)
    VALUES (?, ?, ?)
  `);

  db.transaction(() => {
    for (const c of DEFAULT_CATEGORIES) {
      stmt.run(userId, c.name, c.icon);
    }
  })();
}
