import type { Transaction, CreateTransactionInput, CreateScheduledTransactionInput, UpdateSharedTransactionInput, TransactionFilters } from './transactions.types';
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

export function createTransactionsRepo(db: Database) {
  return {
    getByUserId(userId: number, filters: TransactionFilters): Transaction[] {
      let query = `
        SELECT t.id,
               t.user_id,
               t.account_id,
               t.type,
               t.amount,
               t.description,
               t.category_id,
               t.payment_method_id,
               t.date,
               t.transfer_peer_id,
               t.scheduled_id,
               t.validated,
               t.notes,
               t.created_at,
               a.name                as account_name,
               COALESCE(c.name, '')  as category,
               COALESCE(pm.name, '') as payment_method
        FROM transactions t
               JOIN accounts a ON t.account_id = a.id
               LEFT JOIN categories c ON t.category_id = c.id
               LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
        WHERE t.user_id = ?
      `;
      const params: (number | string)[] = [userId];
      if (filters.account_id) {
        query += ' AND t.account_id = ?';
        params.push(filters.account_id);
      }
      if (filters.type) {
        query += ' AND t.type = ?';
        params.push(filters.type);
      }
      if (filters.category_id) {
        query += ' AND t.category_id = ?';
        params.push(filters.category_id);
      }
      query += ' ORDER BY t.date DESC, t.created_at DESC';
      return db.prepare(query).all(...params) as Transaction[];
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
