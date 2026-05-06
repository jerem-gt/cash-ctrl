import type { Database } from 'better-sqlite3';

import type { Transaction, UpdateSharedTransactionInput } from '../transactions/transactions.types';
import type { TransferInput } from './transfers.types';

const TX_WITH_DETAILS = `
  SELECT t.id, t.user_id, t.account_id, t.type, t.amount, t.description,
         t.subcategory_id, t.payment_method_id,
         t.date, t.transfer_peer_id, t.scheduled_id, t.validated, t.notes, t.created_at,
         sc.category_id,
         a.name as account_name,
         COALESCE(pm.name, '') as payment_method
  FROM transactions t
  JOIN accounts a ON t.account_id = a.id
  LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
  LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
  WHERE t.id = :id
`;

export function createTransfersRepo(db: Database) {
  const getTransferSubcatStmt = db.prepare<[], { id: number }>(
    `SELECT id FROM subcategories WHERE name = 'Transfert'`,
  );
  const getTransferPmStmt = db.prepare<[], { id: number }>(
    `SELECT id FROM payment_methods WHERE name = 'Transfert'`,
  );
  const insertTxStmt = db.prepare(`
      INSERT INTO transactions
      (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, notes, validated)
      VALUES
          (:userId, :accountId, :type, :amount, :description, :subcategoryId, :date, :paymentMethodId, :notes, :validated)
  `);
  const setPeerStmt = db.prepare(
    'UPDATE transactions SET transfer_peer_id = :peerId WHERE id = :id',
  );
  const getByIdStmt = db.prepare<{ id: number }, Transaction>(TX_WITH_DETAILS);
  const updateSharedStmt = db.prepare(
    `UPDATE transactions SET amount=:amount, description=:description, date=:date, validated=:validated,
     account_id=COALESCE(:accountId, account_id) WHERE id=:id AND user_id=:userId`,
  );
  const deleteStmt = db.prepare('DELETE FROM transactions WHERE id = :id AND user_id = :userId');

  return {
    create(
      userId: number,
      data: TransferInput,
    ): { expense: Transaction | undefined; income: Transaction | undefined } {
      const transferSubcat = getTransferSubcatStmt.get();
      const transferPm = getTransferPmStmt.get();
      const subcategoryId = transferSubcat?.id ?? null;
      const paymentMethodId = transferPm?.id ?? null;

      return db.transaction(() => {
        const notes = data.notes ?? null;
        const validated = data.validated ? 1 : 0;
        const expenseId = Number(
          insertTxStmt.run({
            userId,
            accountId: data.from_account_id,
            type: 'expense',
            amount: data.amount,
            description: data.description,
            subcategoryId,
            date: data.date,
            paymentMethodId,
            notes,
            validated,
          }).lastInsertRowid,
        );
        const incomeId = Number(
          insertTxStmt.run({
            userId,
            accountId: data.to_account_id,
            type: 'income',
            amount: data.amount,
            description: data.description,
            subcategoryId,
            date: data.date,
            paymentMethodId,
            notes,
            validated,
          }).lastInsertRowid,
        );
        setPeerStmt.run({ peerId: incomeId, id: expenseId });
        setPeerStmt.run({ peerId: expenseId, id: incomeId });
        return {
          expense: getByIdStmt.get({ id: expenseId }) ?? undefined,
          income: getByIdStmt.get({ id: incomeId }) ?? undefined,
        };
      })();
    },

    linkTransferPeers(id1: number, id2: number): void {
      setPeerStmt.run({ peerId: id2, id: id1 });
      setPeerStmt.run({ peerId: id1, id: id2 });
    },

    updateBothShared(
      userId: number,
      id: number,
      peerId: number,
      data: UpdateSharedTransactionInput,
    ): void {
      const base = {
        amount: data.amount,
        description: data.description,
        date: data.date,
        validated: data.validated ? 1 : 0,
        userId,
      };
      db.transaction(() => {
        updateSharedStmt.run({ ...base, accountId: data.this_account_id ?? null, id });
        updateSharedStmt.run({ ...base, accountId: data.peer_account_id ?? null, id: peerId });
      })();
    },

    deleteWithPeer(userId: number, id: number, peerId: number) {
      return db.transaction(() => {
        deleteStmt.run({ id: peerId, userId });
        deleteStmt.run({ id, userId });
      })();
    },
  };
}
