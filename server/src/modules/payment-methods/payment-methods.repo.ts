import type { Database } from 'better-sqlite3';

import type { CreatePaymentMethodInput, PaymentMethod, PaymentMethodWithCount } from './payment-methods.types';

export function createPaymentMethodsRepo(db: Database) {
  return {
    getAll(): PaymentMethodWithCount[] {
      return db.prepare<[], PaymentMethodWithCount>(`
        SELECT pm.*, COUNT(t.id) as tx_count
        FROM payment_methods pm
               LEFT JOIN transactions t ON t.payment_method_id = pm.id
        GROUP BY pm.id
        ORDER BY pm.created_at
      `).all();
    },

    getById(id: number): PaymentMethod | undefined {
      return db.prepare<[number], PaymentMethod>('SELECT * FROM payment_methods WHERE id = ?').get(id) ?? undefined;
    },

    getTxCount(id: number): number {
      return db.prepare<[number], {
        n: number
      }>('SELECT COUNT(*) as n FROM transactions WHERE payment_method_id = ?').get(id)?.n ?? 0;
    },

    create(data: CreatePaymentMethodInput) {
      return db.prepare('INSERT INTO payment_methods (name, icon) VALUES (?, ?)').run(data.name, data.icon);
    },

    update(id: number, data: CreatePaymentMethodInput) {
      return db.prepare('UPDATE payment_methods SET name = ?, icon = ? WHERE id = ?').run(data.name, data.icon, id);
    },

    delete(id: number) {
      return db.prepare('DELETE FROM payment_methods WHERE id = ?').run(id);
    },
  };
}
