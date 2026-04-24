import type { Database } from 'better-sqlite3';

import type {
  CreateScheduledTransactionInput,
  CreateTransactionInput,
  PaginatedResult,
  Transaction,
  TransactionFilters,
  UpdateSharedTransactionInput
} from './transactions.types';

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

export function createTransactionsRepo(db: Database) {
  return {
    getByUserId(userId: number, filters: TransactionFilters): PaginatedResult<Transaction> {
      const page  = Math.max(1, filters.page  ?? 1);
      const limit = Math.min(100, Math.max(1, filters.limit ?? 25));

      const FROM_WHERE = `
        FROM transactions t
             JOIN accounts a ON t.account_id = a.id
             LEFT JOIN categories c ON t.category_id = c.id
             LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
        WHERE t.user_id = ?`;

      const params: (number | string)[] = [userId];
      let conditions = '';
      if (filters.account_id) { conditions += ' AND t.account_id = ?'; params.push(filters.account_id); }
      if (filters.type)        { conditions += ' AND t.type = ?';        params.push(filters.type); }
      if (filters.category_id) { conditions += ' AND t.category_id = ?'; params.push(filters.category_id); }

      const total = (db.prepare<(number | string)[], { count: number }>(
        `SELECT COUNT(*) AS count ${FROM_WHERE}${conditions}`,
      ).get(...params) as { count: number }).count;

      const data = db.prepare<(number | string)[], Transaction>(`
        SELECT t.id, t.user_id, t.account_id, t.type, t.amount, t.description,
               t.category_id, t.payment_method_id, t.date, t.transfer_peer_id,
               t.scheduled_id, t.validated, t.notes, t.created_at,
               a.name                AS account_name,
               COALESCE(c.name, '')  AS category,
               COALESCE(pm.name, '') AS payment_method
        ${FROM_WHERE}${conditions}
        ORDER BY t.date DESC, t.created_at DESC
        LIMIT ? OFFSET ?`,
      ).all(...params, limit, (page - 1) * limit);

      const totalPages = Math.max(1, Math.ceil(total / limit));
      return { data, total, page, totalPages };
    },

    getById(id: number, userId: number): Transaction | undefined {
      return db.prepare<[number, number], Transaction>('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, userId) ?? undefined;
    },

    getWithDetails(id: number): Transaction | undefined {
      return db.prepare<[number], Transaction>(TX_WITH_DETAILS).get(id) ?? undefined;
    },

    accountExists(accountId: number, userId: number): boolean {
      return !!db.prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?').get(accountId, userId);
    },

    create(userId: number, data: CreateTransactionInput) {
      return db.prepare(
          'INSERT INTO transactions (user_id, account_id, type, amount, description, category_id, date, payment_method_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(userId, data.account_id, data.type, data.amount, data.description, data.category_id, data.date, data.payment_method_id, data.notes);
    },

    createScheduled(userId: number, data: CreateScheduledTransactionInput): number {
      return Number(
        db.prepare(
          'INSERT INTO transactions (user_id, account_id, type, amount, description, category_id, date, payment_method_id, notes, scheduled_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(userId, data.account_id, data.type, data.amount, data.description, data.category_id, data.date, data.payment_method_id, data.notes, data.scheduled_id).lastInsertRowid,
      );
    },

    linkTransferPeers(id1: number, id2: number): void {
      const stmt = db.prepare('UPDATE transactions SET transfer_peer_id = ? WHERE id = ?');
      stmt.run(id2, id1);
      stmt.run(id1, id2);
    },

    update(userId: number, id: number, data: CreateTransactionInput) {
      return db.prepare(
          'UPDATE transactions SET account_id = ?, type = ?, amount = ?, description = ?, category_id = ?, date = ?, payment_method_id = ?, notes = ?, validated = ? WHERE id = ? AND user_id = ?',
      ).run(data.account_id, data.type, data.amount, data.description, data.category_id, data.date, data.payment_method_id, data.notes, data.validated ? 1 : 0, id, userId);
    },

    updateBothShared(userId: number, id: number, peerId: number, data: UpdateSharedTransactionInput) {
      const stmt = db.prepare('UPDATE transactions SET amount = ?, description = ?, date = ? WHERE id = ? AND user_id = ?');
      db.transaction(() => {
        stmt.run(data.amount, data.description, data.date, id, userId);
        stmt.run(data.amount, data.description, data.date, peerId, userId);
      })();
    },

    setValidated(userId: number, id: number, validated: boolean) {
      return db.prepare('UPDATE transactions SET validated = ? WHERE id = ? AND user_id = ?').run(validated ? 1 : 0, id, userId);
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
