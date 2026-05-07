import type { Database } from 'better-sqlite3';

export const DEFAULT_PAYMENT_METHODS = [
  { name: 'Chèque', icon: '📝' },
  { name: 'Virement', icon: '↔️' },
  { name: 'Carte Bancaire', icon: '💳' },
  { name: 'Prélèvement', icon: '↕️' },
  { name: 'Transfert', icon: '🔄' },
];

export function seedPaymentMethods(db: Database, userId: number) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO payment_methods (user_id, name, icon)
    VALUES (?, ?, ?)
  `);

  db.transaction(() => {
    for (const m of DEFAULT_PAYMENT_METHODS) {
      stmt.run(userId, m.name, m.icon);
    }
  })();
}
