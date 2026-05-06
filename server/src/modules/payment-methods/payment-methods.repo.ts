import type { Database } from 'better-sqlite3';

import type {
  CreatePaymentMethodInput,
  PaymentMethod,
  PaymentMethodWithCount,
} from './payment-methods.types';

export function createPaymentMethodsRepo(db: Database) {
  const getAllStmt = db.prepare<[], PaymentMethodWithCount>(`
      SELECT pm.*, COUNT(t.id) as tx_count
      FROM payment_methods pm
      LEFT JOIN transactions t ON t.payment_method_id = pm.id
      GROUP BY pm.id
      ORDER BY pm.created_at
  `);
  const getByIdStmt = db.prepare<{ id: number }, PaymentMethod>(
    'SELECT * FROM payment_methods WHERE id = :id',
  );
  const createStmt = db.prepare('INSERT INTO payment_methods (name, icon) VALUES (:name, :icon)');
  const updateStmt = db.prepare(
    'UPDATE payment_methods SET name = :name, icon = :icon WHERE id = :id',
  );
  const deleteStmt = db.prepare('DELETE FROM payment_methods WHERE id = :id');

  return {
    getAll: () => getAllStmt.all(),

    getById: (id: number) => getByIdStmt.get({ id }),

    create: (data: CreatePaymentMethodInput) => createStmt.run(data),

    update: (id: number, data: CreatePaymentMethodInput) =>
      updateStmt.run({
        ...data,
        id,
      }),

    delete: (id: number) => deleteStmt.run({ id }),
  };
}
