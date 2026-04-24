import type { Transaction } from '../transactions/transactions.types';
import type { TransferInput } from './transfers.types';
import type { Database } from 'better-sqlite3';

const TX_WITH_DETAILS = `
  SELECT t.id, t.user_id, t.account_id, t.type, t.amount, t.description,
         t.category_id, t.payment_method_id,
         t.date, t.transfer_peer_id, t.scheduled_id, t.validated, t.notes, t.created_at,
         a.name as account_name,
         COALESCE(c.name, '') as category,
         COALESCE(pm.name, '') as payment_method
  FROM transactions t
  JOIN accounts a ON t.account_id = a.id
  LEFT JOIN categories c ON t.category_id = c.id
  LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
  WHERE t.id = ?
`;

export function createTransfersRepo(db: Database) {
  return {
    accountExists(accountId: number, userId: number): boolean {
      return !!db.prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?').get(accountId, userId);
    },

    create(userId: number, data: TransferInput): { expense: Transaction | undefined; income: Transaction | undefined } {
      const transferCat = db.prepare<[], { id: number }>(`SELECT id
                                                          FROM categories
                                                          WHERE name = 'Transfert'`).get();
      const transferPm = db.prepare<[], { id: number }>(`SELECT id
                                                         FROM payment_methods
                                                         WHERE name = 'Transfert'`).get();
      const TRANSFER_CAT_ID = transferCat?.id ?? null;
      const TRANSFER_PM_ID = transferPm?.id ?? null;

      const insertTx = db.prepare(
          'INSERT INTO transactions (user_id, account_id, type, amount, description, category_id, date, payment_method_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      );
      const setPeer = db.prepare('UPDATE transactions SET transfer_peer_id = ? WHERE id = ?');
      const getTx = db.prepare<[number], Transaction>(TX_WITH_DETAILS);

      return db.transaction(() => {
        const expenseId = Number(insertTx.run(
            userId, data.from_account_id, 'expense', data.amount, data.description,
            TRANSFER_CAT_ID, data.date, TRANSFER_PM_ID, null,
        ).lastInsertRowid);
        const incomeId = Number(insertTx.run(
            userId, data.to_account_id, 'income', data.amount, data.description,
            TRANSFER_CAT_ID, data.date, TRANSFER_PM_ID, null,
        ).lastInsertRowid);
        setPeer.run(incomeId, expenseId);
        setPeer.run(expenseId, incomeId);
        return {expense: getTx.get(expenseId) ?? undefined, income: getTx.get(incomeId) ?? undefined};
      })();
    },
  };
}
