import type { Database } from 'better-sqlite3';

import type {
  CreateScheduledTransactionInput,
  CreateTransactionInput,
  PaginatedResult,
  Transaction,
  TransactionFilters,
  TransactionSplit,
  UpdateSharedTransactionInput,
} from './transactions.types';

interface TransactionRow extends Omit<Transaction, 'splits'> {
  splits_json: string | null;
}

function parseSplits(row: TransactionRow): Transaction {
  const { splits_json, ...rest } = row;
  if (!splits_json) return rest;
  const splits = JSON.parse(splits_json) as TransactionSplit[];
  return splits.length > 0 ? { ...rest, splits } : rest;
}

const SPLITS_SUBQUERY = `
  COALESCE(
    (SELECT json_group_array(json_object('id', ts.id, 'subcategory_id', ts.subcategory_id, 'amount', ts.amount))
     FROM transaction_splits ts WHERE ts.transaction_id = t.id),
    '[]'
  ) AS splits_json`;

const TX_WITH_DETAILS = `
  SELECT t.id, t.user_id, t.account_id, t.type, t.amount, t.description,
         t.subcategory_id, t.payment_method_id,
         t.date, t.transfer_peer_id, t.scheduled_id, t.validated, t.notes, t.reimbursement_status, t.created_at,
         a.name                as account_name,
         sc.category_id,
         COALESCE(c.name, '')  as category,
         COALESCE(sc.name, '') as subcategory,
         COALESCE(pm.name, '') as payment_method,
         (SELECT account_id FROM transactions WHERE id = t.transfer_peer_id) AS transfer_peer_account_id,
         ${SPLITS_SUBQUERY}
  FROM transactions t
  JOIN accounts a ON t.account_id = a.id
  LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
  LEFT JOIN categories c ON sc.category_id = c.id
  LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
  WHERE t.id = ?
`;

export function createTransactionsRepo(db: Database) {
  return {
    getByUserId(userId: number, filters: TransactionFilters): PaginatedResult<Transaction> {
      const page = Math.max(1, filters.page ?? 1);
      const limit = Math.min(100, Math.max(1, filters.limit ?? 25));

      const FROM_WHERE = `
        FROM transactions t
             JOIN accounts a ON t.account_id = a.id
             LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
             LEFT JOIN categories c ON sc.category_id = c.id
             LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
        WHERE t.user_id = ?`;

      const params: (number | string)[] = [userId];
      let conditions = '';
      if (filters.account_id) {
        conditions += ' AND t.account_id = ?';
        params.push(filters.account_id);
      }
      if (filters.type) {
        conditions += ' AND t.type = ?';
        params.push(filters.type);
      }
      if (filters.category_id) {
        conditions += ' AND sc.category_id = ?';
        params.push(filters.category_id);
      }
      if (filters.subcategory_id) {
        conditions += ' AND t.subcategory_id = ?';
        params.push(filters.subcategory_id);
      }

      const total = (
        db
          .prepare<
            (number | string)[],
            { count: number }
          >(`SELECT COUNT(*) AS count ${FROM_WHERE}${conditions}`)
          .get(...params) as { count: number }
      ).count;

      const rawRows = db
        .prepare<(number | string)[], TransactionRow>(
          `
        SELECT t.id, t.user_id, t.account_id, t.type, t.amount, t.description,
               t.subcategory_id, t.payment_method_id, t.date, t.transfer_peer_id,
               t.scheduled_id, t.validated, t.notes, t.reimbursement_status, t.created_at,
               sc.category_id,
               a.name                AS account_name,
               COALESCE(c.name, '')  AS category,
               COALESCE(sc.name, '') AS subcategory,
               COALESCE(pm.name, '') AS payment_method,
               (SELECT account_id FROM transactions WHERE id = t.transfer_peer_id) AS transfer_peer_account_id,
               ${SPLITS_SUBQUERY}
        ${FROM_WHERE}${conditions}
        ORDER BY t.date DESC, t.created_at DESC
        LIMIT ? OFFSET ?`,
        )
        .all(...params, limit, (page - 1) * limit);
      const data = rawRows.map(parseSplits);

      const totalPages = Math.max(1, Math.ceil(total / limit));
      return { data, total, page, totalPages };
    },

    getById(id: number, userId: number): Transaction | undefined {
      return (
        db
          .prepare<
            [number, number],
            Transaction
          >('SELECT * FROM transactions WHERE id = ? AND user_id = ?')
          .get(id, userId) ?? undefined
      );
    },

    getWithDetails(id: number): Transaction | undefined {
      const row = db.prepare<[number], TransactionRow>(TX_WITH_DETAILS).get(id);
      return row ? parseSplits(row) : undefined;
    },

    accountExists(accountId: number, userId: number): boolean {
      return !!db
        .prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?')
        .get(accountId, userId);
    },

    create(userId: number, data: CreateTransactionInput) {
      return db.transaction(() => {
        const result = db
          .prepare(
            'INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, notes, reimbursement_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .run(
            userId,
            data.account_id,
            data.type,
            data.amount,
            data.description,
            data.subcategory_id,
            data.date,
            data.payment_method_id,
            data.notes,
            data.reimbursement_status ?? null,
          );
        if (data.splits?.length) {
          const txId = Number(result.lastInsertRowid);
          const ins = db.prepare(
            'INSERT INTO transaction_splits (transaction_id, subcategory_id, amount) VALUES (?, ?, ?)',
          );
          for (const s of data.splits) ins.run(txId, s.subcategory_id, s.amount);
        }
        return result;
      })();
    },

    createScheduled(userId: number, data: CreateScheduledTransactionInput): number {
      return Number(
        db
          .prepare(
            'INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, notes, scheduled_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .run(
            userId,
            data.account_id,
            data.type,
            data.amount,
            data.description,
            data.subcategory_id,
            data.date,
            data.payment_method_id,
            data.notes,
            data.scheduled_id,
          ).lastInsertRowid,
      );
    },

    linkTransferPeers(id1: number, id2: number): void {
      const stmt = db.prepare('UPDATE transactions SET transfer_peer_id = ? WHERE id = ?');
      stmt.run(id2, id1);
      stmt.run(id1, id2);
    },

    update(userId: number, id: number, data: CreateTransactionInput) {
      return db.transaction(() => {
        const result = db
          .prepare(
            'UPDATE transactions SET account_id = ?, type = ?, amount = ?, description = ?, subcategory_id = ?, date = ?, payment_method_id = ?, notes = ?, validated = ? WHERE id = ? AND user_id = ?',
          )
          .run(
            data.account_id,
            data.type,
            data.amount,
            data.description,
            data.subcategory_id,
            data.date,
            data.payment_method_id,
            data.notes,
            data.validated ? 1 : 0,
            id,
            userId,
          );
        db.prepare('DELETE FROM transaction_splits WHERE transaction_id = ?').run(id);
        if (data.splits?.length) {
          const ins = db.prepare(
            'INSERT INTO transaction_splits (transaction_id, subcategory_id, amount) VALUES (?, ?, ?)',
          );
          for (const s of data.splits) ins.run(id, s.subcategory_id, s.amount);
        }
        return result;
      })();
    },

    updateBothShared(
      userId: number,
      id: number,
      peerId: number,
      data: UpdateSharedTransactionInput,
    ) {
      const v = data.validated ? 1 : 0;
      db.transaction(() => {
        if (data.this_account_id === undefined) {
          const stmt = db.prepare(
            'UPDATE transactions SET amount=?, description=?, date=?, validated=? WHERE id=? AND user_id=?',
          );
          stmt.run(data.amount, data.description, data.date, v, id, userId);
          stmt.run(data.amount, data.description, data.date, v, peerId, userId);
        } else {
          db.prepare(
            'UPDATE transactions SET amount=?, description=?, date=?, validated=?, account_id=? WHERE id=? AND user_id=?',
          ).run(data.amount, data.description, data.date, v, data.this_account_id, id, userId);
          db.prepare(
            'UPDATE transactions SET amount=?, description=?, date=?, validated=?, account_id=? WHERE id=? AND user_id=?',
          ).run(data.amount, data.description, data.date, v, data.peer_account_id, peerId, userId);
        }
      })();
    },

    setValidated(userId: number, id: number, validated: boolean) {
      return db
        .prepare('UPDATE transactions SET validated = ? WHERE id = ? AND user_id = ?')
        .run(validated ? 1 : 0, id, userId);
    },

    setReimbursementStatus(userId: number, id: number, status: 'en_attente' | 'rembourse' | null) {
      return db
        .prepare('UPDATE transactions SET reimbursement_status = ? WHERE id = ? AND user_id = ?')
        .run(status, id, userId);
    },

    delete(userId: number, id: number) {
      return db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(id, userId);
    },

    deleteWithPeer(userId: number, id: number, peerId: number) {
      const stmt = db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?');
      db.transaction(() => {
        stmt.run(peerId, userId);
        stmt.run(id, userId);
      })();
    },
  };
}
