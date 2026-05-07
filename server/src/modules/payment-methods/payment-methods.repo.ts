import type { Database } from 'better-sqlite3';

import type {
  CreatePaymentMethodInput,
  PaymentMethod,
  PaymentMethodWithCount,
} from './payment-methods.types';

export function createPaymentMethodsRepo(db: Database, userId: number) {
  const getAllStmt = db.prepare<{ userId: number }, PaymentMethodWithCount>(`
      SELECT pm.*, COUNT(t.id) as tx_count
      FROM payment_methods pm
      LEFT JOIN transactions t ON t.payment_method_id = pm.id AND t.user_id = :userId
      WHERE pm.user_id = :userId
      GROUP BY pm.id
      ORDER BY pm.created_at
  `);
  const getByIdStmt = db.prepare<{ id: number; userId: number }, PaymentMethod>(
    'SELECT * FROM payment_methods WHERE id = :id AND user_id = :userId',
  );
  const createStmt = db.prepare(
    'INSERT INTO payment_methods (user_id, name, icon) VALUES (:userId, :name, :icon)',
  );
  const updateStmt = db.prepare(
    'UPDATE payment_methods SET name = :name, icon = :icon WHERE id = :id AND user_id = :userId',
  );
  const deleteStmt = db.prepare('DELETE FROM payment_methods WHERE id = :id AND user_id = :userId');

  return {
    getAll: () => getAllStmt.all({ userId }),

    getById: (id: number) => getByIdStmt.get({ id, userId }),

    create: (data: CreatePaymentMethodInput) => createStmt.run({ ...data, userId }),

    update: (id: number, data: CreatePaymentMethodInput) => updateStmt.run({ ...data, id, userId }),

    delete: (id: number) => deleteStmt.run({ id, userId }),
  };
}
