import type { Database } from 'better-sqlite3';

import type { PendingReimbursement, Reimbursement } from './reimbursements.types';

export function createReimbursementsRepo(db: Database) {
  return {
    getByTransactionId(transactionId: number, userId: number): Reimbursement[] {
      const tx = db
        .prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?')
        .get(transactionId, userId);
      if (!tx) return [];

      return db
        .prepare<[number], Reimbursement>(
          `
          SELECT lt.id, lt.amount, lt.description, lt.date,
                 COALESCE(sc.name, '') AS subcategory,
                 COALESCE(c.name, '')  AS category,
                 COALESCE(pm.name, '') AS payment_method
          FROM reimbursements r
          JOIN transactions lt ON lt.id = r.linked_transaction_id
          LEFT JOIN subcategories sc ON lt.subcategory_id = sc.id
          LEFT JOIN categories c ON sc.category_id = c.id
          LEFT JOIN payment_methods pm ON lt.payment_method_id = pm.id
          WHERE r.transaction_id = ?
          ORDER BY lt.date DESC
        `,
        )
        .all(transactionId);
    },

    link(transactionId: number, linkedTransactionId: number): void {
      db.prepare(
        'INSERT OR IGNORE INTO reimbursements (transaction_id, linked_transaction_id) VALUES (?, ?)',
      ).run(transactionId, linkedTransactionId);
    },

    unlink(transactionId: number, linkedTransactionId: number): void {
      db.prepare(
        'DELETE FROM reimbursements WHERE transaction_id = ? AND linked_transaction_id = ?',
      ).run(transactionId, linkedTransactionId);
    },

    getPendingWithSummary(userId: number): PendingReimbursement[] {
      return db
        .prepare<[number], PendingReimbursement>(
          `
          SELECT t.id, t.amount, t.description, t.date,
                 COALESCE(sc.name, '') AS subcategory,
                 COALESCE(c.name, '')  AS category,
                 a.name               AS account_name,
                 COALESCE(SUM(lt.amount), 0) AS total_reimbursed
          FROM transactions t
          JOIN accounts a ON t.account_id = a.id
          LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
          LEFT JOIN categories c ON sc.category_id = c.id
          LEFT JOIN reimbursements r ON r.transaction_id = t.id
          LEFT JOIN transactions lt ON lt.id = r.linked_transaction_id
          WHERE t.user_id = ? AND t.reimbursement_status = 'en_attente'
          GROUP BY t.id
          ORDER BY t.date DESC
        `,
        )
        .all(userId);
    },
  };
}
