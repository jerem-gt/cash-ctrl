import type { Database } from 'better-sqlite3';

import { getTransferIds } from '../../lib/administrationDataConstants';
import { toCents } from '../../lib/money';
import { parseSplits, TransactionRow, TX_WITH_DETAILS } from '../transactions/transactions.repo';
import type { Transaction, UpdateSharedTransactionInput } from '../transactions/transactions.types';
import type { TransferInput } from './transfers.types';

export function createTransfersRepo(db: Database) {
  const insertTxStmt = db.prepare(`
      INSERT INTO transactions
      (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, notes, validated, scheduled_id)
      VALUES
          (:userId, :accountId, :type, :amount, :description, :subcategoryId, :date, :paymentMethodId, :notes, :validated, :scheduledId)
  `);
  const setPeerStmt = db.prepare(
    'UPDATE transactions SET transfer_peer_id = :peerId WHERE id = :id',
  );
  const getByIdStmt = db.prepare<{ id: number }, TransactionRow>(
    `${TX_WITH_DETAILS} WHERE t.id = :id GROUP BY t.id`,
  );
  const updateSharedStmt = db.prepare(
    `UPDATE transactions SET amount=:amount, description=:description, date=:date, validated=:validated,
     account_id=COALESCE(:accountId, account_id) WHERE id=:id AND user_id=:userId`,
  );
  const deleteStmt = db.prepare('DELETE FROM transactions WHERE id = :id AND user_id = :userId');

  return {
    create(userId: number, data: TransferInput): { expense: Transaction; income: Transaction } {
      return db.transaction(() => {
        const transferIds = getTransferIds(db, userId);
        const notes = data.notes ?? null;
        const validated = data.validated ? 1 : 0;
        const amountCents = toCents(data.amount);
        const expenseId = Number(
          insertTxStmt.run({
            userId,
            accountId: data.from_account_id,
            type: 'expense',
            amount: amountCents,
            description: data.description,
            subcategoryId: transferIds.subcategoryId,
            date: data.date,
            paymentMethodId: transferIds.paymentMethodId,
            notes,
            validated,
            scheduledId: data.scheduled_id,
          }).lastInsertRowid,
        );
        const incomeId = Number(
          insertTxStmt.run({
            userId,
            accountId: data.to_account_id,
            type: 'income',
            amount: amountCents,
            description: data.description,
            subcategoryId: transferIds.subcategoryId,
            date: data.date,
            paymentMethodId: transferIds.paymentMethodId,
            notes,
            validated,
            scheduledId: data.scheduled_id,
          }).lastInsertRowid,
        );
        setPeerStmt.run({ peerId: incomeId, id: expenseId });
        setPeerStmt.run({ peerId: expenseId, id: incomeId });
        return {
          expense: parseSplits(getByIdStmt.get({ id: expenseId })!),
          income: parseSplits(getByIdStmt.get({ id: incomeId })!),
        };
      })();
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
        const base2 = { ...base, amount: toCents(data.amount) };
        updateSharedStmt.run({ ...base2, accountId: data.this_account_id ?? null, id });
        updateSharedStmt.run({ ...base2, accountId: data.peer_account_id ?? null, id: peerId });
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
