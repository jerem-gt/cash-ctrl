import type { Database } from 'better-sqlite3';

import type { AccountType, AccountTypeWithCount } from './account-types.types';

export function createAccountTypesRepo(db: Database) {
  return {
    getAll(): AccountTypeWithCount[] {
      return db.prepare<[], AccountTypeWithCount>(
          `SELECT at.*, COUNT(a.id) as acc_count
           FROM account_types at
                  LEFT JOIN accounts a ON a.account_type_id = at.id
           GROUP BY at.id
           ORDER BY at.created_at`,
      ).all();
    },

    getById(id: number): AccountType | undefined {
      return db.prepare<[number], AccountType>('SELECT * FROM account_types WHERE id = ?').get(id) ?? undefined;
    },

    getAccountCount(id: number): number {
      return db.prepare<[number], {
        cnt: number
      }>('SELECT COUNT(*) as cnt FROM accounts WHERE account_type_id = ?').get(id)?.cnt ?? 0;
    },

    create(name: string) {
      return db.prepare('INSERT INTO account_types (name) VALUES (?)').run(name);
    },

    update(id: number, name: string) {
      return db.prepare('UPDATE account_types SET name = ? WHERE id = ?').run(name, id);
    },

    delete(id: number) {
      return db.prepare('DELETE FROM account_types WHERE id = ?').run(id);
    },
  };
}
