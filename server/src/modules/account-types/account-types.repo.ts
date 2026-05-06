import type { Database } from 'better-sqlite3';

import type { AccountType, AccountTypeWithCount } from './account-types.types';

export function createAccountTypesRepo(db: Database) {
  const getAllStmt = db.prepare<[], AccountTypeWithCount>(`
    SELECT at.*, COUNT(a.id) as acc_count
    FROM account_types at
    LEFT JOIN accounts a ON a.account_type_id = at.id
    GROUP BY at.id
    ORDER BY at.created_at
  `);
  const getByIdStmt = db.prepare<{ id: number }, AccountType>(
    'SELECT * FROM account_types WHERE id = :id',
  );
  const deleteStmt = db.prepare('DELETE FROM account_types WHERE id = :id');
  const createStmt = db.prepare(
    'INSERT INTO account_types (name, is_investment, is_loan) VALUES (:name, :is_investment, :is_loan)',
  );
  const updateStmt = db.prepare(
    'UPDATE account_types SET name = :name, is_investment = :is_investment, is_loan = :is_loan WHERE id = :id',
  );

  return {
    getAll: () => getAllStmt.all(),

    getById: (id: number) => getByIdStmt.get({ id }),

    create: (name: string, is_investment: boolean, is_loan: boolean) =>
      createStmt.run({
        name,
        is_investment: is_investment ? 1 : 0,
        is_loan: is_loan ? 1 : 0,
      }),

    update: (id: number, name: string, is_investment: boolean, is_loan: boolean) =>
      updateStmt.run({
        id,
        name,
        is_investment: is_investment ? 1 : 0,
        is_loan: is_loan ? 1 : 0,
      }),

    delete: (id: number) => deleteStmt.run({ id }),
  };
}
