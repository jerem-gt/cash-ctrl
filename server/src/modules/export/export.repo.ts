import type { Database } from 'better-sqlite3';

import { ExportAccount, ExportTransaction, ExportTxRow } from './export.types';

export function createExportRepo(db: Database) {
    return {
        getCsvRows(userId: number): ExportTxRow[] {
            return db.prepare<[number], ExportTxRow>(`
                SELECT t.date,
                       t.type,
                       t.description,
                       COALESCE(c.name, '')  as category,
                       a.name                as account,
                       t.amount,
                       COALESCE(pm.name, '') as payment_method,
                       t.validated,
                       t.notes
                FROM transactions t
                         JOIN accounts a ON t.account_id = a.id
                         LEFT JOIN categories c ON t.category_id = c.id
                         LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
                WHERE t.user_id = ?
                ORDER BY t.date DESC
            `).all(userId);
        },

        getAccounts(userId: number): ExportAccount[] {
            return db.prepare<[number], ExportAccount>(`
                SELECT a.id,
                       a.name,
                       COALESCE(b.name, '')  as bank,
                       COALESCE(at.name, '') as type,
                       a.initial_balance,
                       a.created_at
                FROM accounts a
                         LEFT JOIN banks b ON a.bank_id = b.id
                         LEFT JOIN account_types at ON a.account_type_id = at.id
                WHERE a.user_id = ?
            `).all(userId);
        },

        getTransactions(userId: number): ExportTransaction[] {
            return db.prepare<[number], ExportTransaction>(`
                SELECT t.id,
                       t.account_id,
                       t.type,
                       t.amount,
                       t.description,
                       t.category_id,
                       t.payment_method_id,
                       COALESCE(c.name, '')  as category,
                       COALESCE(pm.name, '') as payment_method,
                       t.date,
                       t.validated,
                       t.notes,
                       t.transfer_peer_id,
                       t.created_at
                FROM transactions t
                         LEFT JOIN categories c ON t.category_id = c.id
                         LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
                WHERE t.user_id = ?
            `).all(userId);
        },
    };
}
