import type { Database } from 'better-sqlite3';

import type { Transaction } from '../transactions/transactions.types';
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
  WHERE t.id = ?
`;

export function createTransfersRepo(db: Database) {
  return {
    accountExists(accountId: number, userId: number): boolean {
      return !!db
        .prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?')
        .get(accountId, userId);
    },

    create(
      userId: number,
      data: TransferInput,
    ): { expense: Transaction | undefined; income: Transaction | undefined } {
      const transferSubcat = db
        .prepare<[], { id: number }>(
          `SELECT id
                                                          FROM subcategories
                                                          WHERE name = 'Transfert'`,
        )
        .get();
      const transferPm = db
        .prepare<[], { id: number }>(
          `SELECT id
                                                         FROM payment_methods
                                                         WHERE name = 'Transfert'`,
        )
        .get();
      const TRANSFER_SUBCAT_ID = transferSubcat?.id ?? null;
      const TRANSFER_PM_ID = transferPm?.id ?? null;

      const insertTx = db.prepare(
        'INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, notes, validated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      );
      const setPeer = db.prepare('UPDATE transactions SET transfer_peer_id = ? WHERE id = ?');
      const getTx = db.prepare<[number], Transaction>(TX_WITH_DETAILS);

      return db.transaction(() => {
        const notes = data.notes ?? null;
        const validated = data.validated ? 1 : 0;
        const expenseId = Number(
          insertTx.run(
            userId,
            data.from_account_id,
            'expense',
            data.amount,
            data.description,
            TRANSFER_SUBCAT_ID,
            data.date,
            TRANSFER_PM_ID,
            notes,
            validated,
          ).lastInsertRowid,
        );
        const incomeId = Number(
          insertTx.run(
            userId,
            data.to_account_id,
            'income',
            data.amount,
            data.description,
            TRANSFER_SUBCAT_ID,
            data.date,
            TRANSFER_PM_ID,
            notes,
            validated,
          ).lastInsertRowid,
        );
        setPeer.run(incomeId, expenseId);
        setPeer.run(expenseId, incomeId);
        return {
          expense: getTx.get(expenseId) ?? undefined,
          income: getTx.get(incomeId) ?? undefined,
        };
      })();
    },
  };
}
