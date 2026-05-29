import type { Database } from 'better-sqlite3';

import type { Lang } from '../../lib/systemEntities';

type AccountTypeDef = {
  code: string;
  names: { fr: string; en: string };
  envelope_type?: string | null;
};

const DEFAULT_ACCOUNT_TYPES: AccountTypeDef[] = [
  { code: 'checking', names: { fr: 'Courant', en: 'Checking' } },
  { code: 'savings', names: { fr: 'Épargne', en: 'Savings' }, envelope_type: 'savings' },
  { code: 'brokerage', names: { fr: 'Bourse', en: 'Brokerage' }, envelope_type: 'investment' },
  { code: 'loan', names: { fr: 'Prêt', en: 'Loan' }, envelope_type: 'loan' },
  { code: 'other', names: { fr: 'Autre', en: 'Other' } },
  {
    code: 'life_insurance',
    names: { fr: 'Assurance Vie', en: 'Life insurance' },
    envelope_type: 'life_insurance',
  },
  { code: 'per', names: { fr: 'PER', en: 'PER' }, envelope_type: 'per' },
];

export function seedAccountTypes(db: Database, userId: number, lang: Lang = 'fr') {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO account_types (user_id, name, envelope_type) VALUES (?, ?, ?)',
  );
  const update = db.prepare(
    'UPDATE account_types SET envelope_type = ? WHERE name = ? AND user_id = ?',
  );

  db.transaction(() => {
    for (const { names, envelope_type = null } of DEFAULT_ACCOUNT_TYPES) {
      const name = names[lang];
      insert.run(userId, name, envelope_type);
      update.run(envelope_type, name, userId);
    }
  })();
}

export { DEFAULT_ACCOUNT_TYPES };
