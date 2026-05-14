import type { Database } from 'better-sqlite3';

import type { AccountType, AccountTypeWithCount } from './account-types.types';

export function createAccountTypesRepo(db: Database, userId: number) {
  const getAllStmt = db.prepare<{ userId: number }, AccountTypeWithCount>(`
    SELECT at.*, COUNT(a.id) as acc_count
    FROM account_types at
    LEFT JOIN accounts a ON a.account_type_id = at.id AND a.user_id = :userId
    WHERE at.user_id = :userId
    GROUP BY at.id
    ORDER BY at.created_at
  `);
  const getByIdStmt = db.prepare<{ id: number; userId: number }, AccountType>(
    'SELECT * FROM account_types WHERE id = :id AND user_id = :userId',
  );
  const deleteStmt = db.prepare('DELETE FROM account_types WHERE id = :id AND user_id = :userId');
  const createStmt = db.prepare(
    'INSERT INTO account_types (user_id, name, envelope_type) VALUES (:userId, :name, :envelope_type)',
  );
  const updateStmt = db.prepare(
    'UPDATE account_types SET name = :name, envelope_type = :envelope_type WHERE id = :id AND user_id = :userId',
  );

  return {
    getAll: () => getAllStmt.all({ userId }),

    getById: (id: number) => getByIdStmt.get({ id, userId }),

    create: (name: string, envelope_type: string | null) =>
      createStmt.run({ userId, name, envelope_type }),

    update: (id: number, name: string, envelope_type: string | null) =>
      updateStmt.run({ id, userId, name, envelope_type }),

    delete: (id: number) => deleteStmt.run({ id, userId }),
  };
}
