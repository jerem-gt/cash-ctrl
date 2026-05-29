import type { Database } from 'better-sqlite3';

import type { Lang } from '../../lib/systemEntities';

type CategoryDef = {
  code: string;
  names: { fr: string; en: string };
  icon: string;
};

const DEFAULT_CATEGORIES: CategoryDef[] = [
  { code: 'housing', names: { fr: 'Logement', en: 'Housing' }, icon: '🏠' },
  { code: 'car', names: { fr: 'Automobile', en: 'Car' }, icon: '🚗' },
  { code: 'transit', names: { fr: 'Transports en commun', en: 'Public transit' }, icon: '🚌' },
  { code: 'health', names: { fr: 'Santé', en: 'Health' }, icon: '⚕️' },
  { code: 'food', names: { fr: 'Alimentation', en: 'Food' }, icon: '🍴' },
  { code: 'daily_life', names: { fr: 'Vie quotidienne', en: 'Daily life' }, icon: '🛍️' },
  { code: 'leisure', names: { fr: 'Loisirs', en: 'Leisure' }, icon: '🎮' },
  { code: 'taxes', names: { fr: 'Impôts', en: 'Taxes' }, icon: '💸' },
  { code: 'work_income', names: { fr: 'Revenus du travail', en: 'Work income' }, icon: '💼' },
  {
    code: 'social_benefits',
    names: { fr: 'Prestations sociales', en: 'Social benefits' },
    icon: '🏦',
  },
  {
    code: 'financial_income',
    names: { fr: 'Revenus financiers', en: 'Financial income' },
    icon: '📈',
  },
  { code: 'misc_income', names: { fr: 'Revenus divers', en: 'Miscellaneous income' }, icon: '💰' },
  { code: 'transfer', names: { fr: 'Transfert', en: 'Transfer' }, icon: '🔄' },
  { code: 'other', names: { fr: 'Autre', en: 'Other' }, icon: '❓' },
];

export { DEFAULT_CATEGORIES };

export function seedCategories(
  db: Database,
  userId: number,
  lang: Lang = 'fr',
): Map<string, number> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO categories (user_id, name, icon)
    VALUES (?, ?, ?)
  `);

  const codeToId = new Map<string, number>();

  db.transaction(() => {
    for (const c of DEFAULT_CATEGORIES) {
      const name = c.names[lang];
      const result = stmt.run(userId, name, c.icon);
      let id: number;
      if (result.lastInsertRowid && Number(result.lastInsertRowid) > 0) {
        id = Number(result.lastInsertRowid);
      } else {
        const existing = db
          .prepare('SELECT id FROM categories WHERE user_id = ? AND name = ?')
          .get(userId, name) as { id: number } | undefined;
        id = existing?.id ?? 0;
      }
      if (id > 0) {
        codeToId.set(c.code, id);
      }
    }
  })();

  return codeToId;
}
