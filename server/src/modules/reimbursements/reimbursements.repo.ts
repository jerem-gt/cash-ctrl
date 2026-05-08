import type { Database } from 'better-sqlite3';

import { toEuros } from '../../lib/money';
import type { PendingReimbursement, Reimbursement } from './reimbursements.types';

export function createReimbursementsRepo(db: Database) {
  const getPendingWithSummaryStmt = db.prepare<{ userId: number }, PendingReimbursement>(`
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
      WHERE t.user_id = :userId AND t.reimbursement_status = 'en_attente'
      GROUP BY t.id
      ORDER BY t.date DESC
    `);
  const getReimbursementsByTxStmt = db.prepare<{ txId: number; userId: number }, Reimbursement>(`
      SELECT lt.id, lt.amount, lt.description, lt.date,
             COALESCE(sc.name, '') AS subcategory,
             COALESCE(c.name, '')  AS category,
             COALESCE(pm.name, '') AS payment_method
      FROM reimbursements r
      JOIN transactions t ON r.transaction_id = t.id          -- La transaction source
      JOIN transactions lt ON r.linked_transaction_id = lt.id -- Les transactions liées
      LEFT JOIN subcategories sc ON lt.subcategory_id = sc.id
      LEFT JOIN categories c ON sc.category_id = c.id
      LEFT JOIN payment_methods pm ON lt.payment_method_id = pm.id
      WHERE r.transaction_id = :txId
        AND t.user_id = :userId
      ORDER BY lt.date DESC
    `);
  const linkStmt = db.prepare(
    'INSERT OR IGNORE INTO reimbursements (user_id, transaction_id, linked_transaction_id) VALUES (:userId, :txId, :linkedTxId)',
  );
  const unlinkStmt = db.prepare(
    'DELETE FROM reimbursements WHERE transaction_id = :txId AND linked_transaction_id = :linkedTxId',
  );

  return {
    getByTransactionId: (txId: number, userId: number) =>
      getReimbursementsByTxStmt.all({ txId, userId }).map((r) => ({
        ...r,
        amount: toEuros(r.amount),
      })),
    getPendingWithSummary: (userId: number) =>
      getPendingWithSummaryStmt.all({ userId }).map((r) => ({
        ...r,
        amount: toEuros(r.amount),
        total_reimbursed: toEuros(r.total_reimbursed),
      })),

    link: (userId: number, txId: number, linkedTxId: number) =>
      linkStmt.run({ userId, txId, linkedTxId }),
    unlink: (txId: number, linkedTxId: number) => unlinkStmt.run({ txId, linkedTxId }),
  };
}
