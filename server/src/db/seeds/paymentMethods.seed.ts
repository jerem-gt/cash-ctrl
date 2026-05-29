import type { Database } from 'better-sqlite3';

import type { Lang } from '../../lib/systemEntities';

type PaymentMethodDef = {
  code: string;
  names: { fr: string; en: string };
  icon: string;
};

export const DEFAULT_PAYMENT_METHODS: PaymentMethodDef[] = [
  { code: 'card', names: { fr: 'Carte Bancaire', en: 'Bank card' }, icon: '💳' },
  { code: 'cheque', names: { fr: 'Chèque', en: 'Cheque' }, icon: '📝' },
  { code: 'prelevement', names: { fr: 'Prélèvement', en: 'Direct debit' }, icon: '↕️' },
  { code: 'cash', names: { fr: 'Retrait', en: 'Cash withdrawal' }, icon: '💵' },
  { code: 'transfer_pm', names: { fr: 'Transfert', en: 'Transfer' }, icon: '🔄' },
  { code: 'wire', names: { fr: 'Virement', en: 'Wire transfer' }, icon: '↔️' },
];

export function seedPaymentMethods(
  db: Database,
  userId: number,
  lang: Lang = 'fr',
): Map<string, number> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO payment_methods (user_id, name, icon)
    VALUES (?, ?, ?)
  `);

  const codeToId = new Map<string, number>();

  db.transaction(() => {
    for (const m of DEFAULT_PAYMENT_METHODS) {
      const name = m.names[lang];
      const result = stmt.run(userId, name, m.icon);
      let id: number;
      if (result.lastInsertRowid && Number(result.lastInsertRowid) > 0) {
        id = Number(result.lastInsertRowid);
      } else {
        const existing = db
          .prepare('SELECT id FROM payment_methods WHERE user_id = ? AND name = ?')
          .get(userId, name) as { id: number } | undefined;
        id = existing?.id ?? 0;
      }
      if (id > 0) {
        codeToId.set(m.code, id);
      }
    }
  })();

  return codeToId;
}
