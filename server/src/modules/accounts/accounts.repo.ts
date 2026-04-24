import type { Account, CreateAccountInput, UpdateAccountInput } from './accounts.types';
import type { Database } from 'better-sqlite3';

export function createAccountsRepo(db: Database) {
    return {
        getByUserId(userId: number): Account[] {
            return db.prepare<[number], Account>(
                `SELECT a.id,
                        a.user_id,
                        a.name,
                        a.bank_id,
                        a.account_type_id,
                        a.initial_balance,
                        a.opening_date,
                        a.created_at,
                        COALESCE(b.name, '')  as bank,
                        COALESCE(at.name, '') as type
                 FROM accounts a
                          LEFT JOIN banks b ON a.bank_id = b.id
                          LEFT JOIN account_types at ON a.account_type_id = at.id
                 WHERE a.user_id = ?
                 ORDER BY a.created_at`,
            ).all(userId);
        },

        getById(id: number, userId: number): Account | undefined {
            return db.prepare<[number, number], Account>(
                `SELECT a.id,
                        a.user_id,
                        a.name,
                        a.bank_id,
                        a.account_type_id,
                        a.initial_balance,
                        a.opening_date,
                        a.created_at,
                        COALESCE(b.name, '')  as bank,
                        COALESCE(at.name, '') as type
                 FROM accounts a
                          LEFT JOIN banks b ON a.bank_id = b.id
                          LEFT JOIN account_types at ON a.account_type_id = at.id
                 WHERE a.id = ?
                   AND a.user_id = ?`,
            ).get(id, userId) ?? undefined;
        },

        create(userId: number, data: CreateAccountInput) {
            return db.prepare(
                'INSERT INTO accounts (user_id, name, bank_id, account_type_id, initial_balance, opening_date) VALUES (?, ?, ?, ?, ?, ?)',
            ).run(userId, data.name, data.bank_id, data.account_type_id, data.initial_balance, data.opening_date);
        },

        update(userId: number, id: number, data: UpdateAccountInput) {
            return db.prepare(
                'UPDATE accounts SET name = ?, bank_id = ?, account_type_id = ?, initial_balance = ?, opening_date = ? WHERE id = ? AND user_id = ?',
            ).run(data.name, data.bank_id, data.account_type_id, data.initial_balance, data.opening_date, id, userId);
        },

        delete(userId: number, id: number) {
            return db.prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?').run(id, userId);
        },
    };
}
