import type { Database } from 'better-sqlite3';

const DEFAULT_CATEGORIES = [
  { name: 'Logement', color: '#4A90E2', icon: '🏠' },
  { name: 'Automobile', color: '#5C6BC0', icon: '🚗' },
  { name: 'Transports en commun', color: '#8E9AAF', icon: '🚌' },
  { name: 'Santé', color: '#26A69A', icon: '⚕️' },
  { name: 'Alimentation', color: '#7CB342', icon: '🍴' },
  { name: 'Vie quotidienne', color: '#F06292', icon: '🛍️' },
  { name: 'Loisirs', color: '#9B6DD6', icon: '🎮' },
  { name: 'Impôts', color: '#E65100', icon: '💸' },

  { name: 'Revenus du travail', color: '#2D8A50', icon: '💼' },
  { name: 'Prestations sociales', color: '#66BB6A', icon: '🏦' },
  { name: 'Revenus financiers', color: '#1B5E20', icon: '📈' },
  { name: 'Revenus divers', color: '#A5D6A7', icon: '💰' },

  { name: 'Transfert', color: '#757575', icon: '🔄' },
  { name: 'Autre', color: '#BDBDBD', icon: '❓' },
];

export function seedCategories(db: Database) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO categories (name, color, icon)
    VALUES (?, ?, ?)
  `);

  db.transaction(() => {
    for (const c of DEFAULT_CATEGORIES) {
      stmt.run(c.name, c.color, c.icon);
    }
  })();
}
