import type { Database } from 'better-sqlite3';

import { ReimbursementStatus } from '../../constants';
import type {
  CreateScheduledTransactionInput,
  CreateTransactionInput,
  PaginatedResult,
  Transaction,
  TransactionFilters,
  TransactionSplit,
  UpdateSharedTransactionInput,
} from './transactions.types';

interface TransactionRow extends Omit<Transaction, 'splits' | 'stock_operation'> {
  splits_json: string | null;
  stock_operation_json: string | null;
}

function parseSplits(row: TransactionRow): Transaction {
  const { splits_json, stock_operation_json, ...rest } = row;
  const result: Transaction = rest;
  if (splits_json) {
    const splits = JSON.parse(splits_json) as TransactionSplit[];
    if (splits.length > 0) result.splits = splits;
  }
  if (stock_operation_json) {
    result.stock_operation = JSON.parse(stock_operation_json) as Transaction['stock_operation'];
  }
  return result;
}

const EMPTY_PAGINATED_RESULT: PaginatedResult<Transaction> = {
  data: [],
  total: 0,
  page: 1,
  totalPages: 1,
  balance_before_page: undefined,
};

const SPLITS_SUBQUERY = `
  COALESCE(
    json_group_array(
        json_object('id', ts.id, 'subcategory_id', ts.subcategory_id, 'amount', ts.amount)
    ) FILTER (WHERE ts.id IS NOT NULL), '[]'
  ) AS splits_json`;

const STOCK_OPERATION_SUBQUERY = `
  CASE 
    WHEN so.id IS NOT NULL THEN 
      json_object(
        'id', so.id,
        'account_id', so.account_id,
        'transaction_id', so.transaction_id,
        'ticker', so.ticker,
        'type', so.type,
        'quantity', so.quantity,
        'price_per_share', so.price_per_share,
        'fees', so.fees,
        'date', so.date,
        'created_at', so.created_at
      )
    ELSE NULL 
  END AS stock_operation_json`;

const TX_WITH_DETAILS = `
  SELECT t.id, t.user_id, t.account_id, t.type, t.amount, t.description,
         t.subcategory_id, t.payment_method_id,
         t.date, t.transfer_peer_id, t.scheduled_id, t.validated, t.notes, t.reimbursement_status, t.created_at,
         a.name                as account_name,
         sc.category_id,
         COALESCE(c.name, '')  as category,
         COALESCE(sc.name, '') as subcategory,
         COALESCE(pm.name, '') as payment_method,
         peer.account_id AS transfer_peer_account_id,
         li.principal_amount AS loan_principal,
         ${SPLITS_SUBQUERY},
         ${STOCK_OPERATION_SUBQUERY}
  FROM transactions t
  JOIN accounts a ON t.account_id = a.id
  LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
  LEFT JOIN categories c ON sc.category_id = c.id
  LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
  LEFT JOIN transactions peer ON t.transfer_peer_id = peer.id
  LEFT JOIN loan_installments li ON li.transaction_id = t.id
  LEFT JOIN transaction_splits ts ON ts.transaction_id = t.id
  LEFT JOIN stock_operations so ON so.transaction_id = t.id
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

      if (total === 0) {
        return {
          ...EMPTY_PAGINATED_RESULT,
          balance_before_page: filters.account_id ? 0 : undefined,
        };
      }

      const rawRows = db
        .prepare<(number | string)[], TransactionRow>(
          `${TX_WITH_DETAILS}
          WHERE t.user_id = ?
          ${conditions}
          GROUP BY t.id
          ORDER BY t.date DESC, t.id DESC
          LIMIT ? OFFSET ?
          `,
        )
        .all(...params, limit, (page - 1) * limit);
      const data = rawRows.map(parseSplits);

      const totalPages = Math.max(1, Math.ceil(total / limit));
      const offset = (page - 1) * limit;

      let balance_before_page: number | undefined;
      if (filters.account_id) {
        if (offset === 0 || data.length === 0) {
          // Page 1 ou aucune donnée : le solde précédent est par définition 0
          balance_before_page = 0;
        } else {
          // On prend la première transaction de la page actuelle pour définir la frontière
          const firstTx = data[0];

          const row = db
            .prepare<[number, number, string, string, number], { sum: number }>(
              `
              SELECT COALESCE(SUM(
                CASE WHEN t.type = 'income'
                THEN COALESCE(li.principal_amount, t.amount)
                ELSE -COALESCE(li.principal_amount, t.amount)
                END
              ), 0) AS sum
              FROM transactions t
              LEFT JOIN loan_installments li ON li.transaction_id = t.id
              WHERE t.user_id = ?
                AND t.account_id = ?
                AND (t.date > ? OR (t.date = ? AND t.id > ?))
          `,
            )
            .get(userId, filters.account_id, firstTx.date, firstTx.date, firstTx.id);
          balance_before_page = row?.sum ?? 0;
        }
      }

      return { data, total, page, totalPages, balance_before_page };
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
      const row = db
        .prepare<[number], TransactionRow>(TX_WITH_DETAILS + ' WHERE t.id = ? GROUP BY t.id')
        .get(id);
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
      const v = validated ? 1 : 0;
      db.prepare('UPDATE transactions SET validated = ? WHERE id = ? AND user_id = ?').run(
        v,
        id,
        userId,
      );
      const peer = db
        .prepare<
          [number, number],
          { transfer_peer_id: number | null }
        >('SELECT transfer_peer_id FROM transactions WHERE id = ? AND user_id = ?')
        .get(id, userId);
      if (peer?.transfer_peer_id) {
        db.prepare('UPDATE transactions SET validated = ? WHERE id = ? AND user_id = ?').run(
          v,
          peer.transfer_peer_id,
          userId,
        );
      }
    },

    setReimbursementStatus(userId: number, id: number, status: ReimbursementStatus | null) {
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
