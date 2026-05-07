import type { Database, Statement } from 'better-sqlite3';

import { ReimbursementStatus } from '../../constants';
import type {
  CreateScheduledTransactionInput,
  CreateTransactionInput,
  PaginatedResult,
  QueryParams,
  Transaction,
  TransactionFilters,
  TransactionSplit,
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

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function createTransactionsRepo(db: Database) {
  const getCountByCategoryIdStmt = db
    .prepare<
      { categoryId: number },
      number
    >('SELECT COUNT(*) as n FROM transactions WHERE subcategory_id in (select id from subcategories where category_id = :categoryId)')
    .pluck();
  const getCountBySubcategoryIdStmt = db
    .prepare<
      { subcategoryId: number },
      number
    >('SELECT COUNT(*) as cnt FROM transactions WHERE subcategory_id = :subcategoryId')
    .pluck();
  const getCountByPaymentMethodIdStmt = db
    .prepare<
      { paymentMethodId: number },
      number
    >('SELECT COUNT(*) as cnt FROM transactions WHERE payment_method_id = :paymentMethodId')
    .pluck();
  const getByIdStmt = db.prepare<{ id: number; userId: number }, Transaction>(
    `SELECT * FROM transactions WHERE id = :id AND user_id = :userId`,
  );
  const getByIdWithDetailsStmt = db.prepare<{ id: number }, TransactionRow>(
    `${TX_WITH_DETAILS} WHERE t.id = :id GROUP BY t.id`,
  );
  const getBalanceStmt = db.prepare<
    { id: number; userId: number; accountId: number; date: string },
    { sum: number }
  >(`
      SELECT COALESCE(SUM(
        CASE WHEN t.type = 'income'
        THEN COALESCE(li.principal_amount, t.amount)
        ELSE -COALESCE(li.principal_amount, t.amount)
        END
      ), 0) AS sum
      FROM transactions t
      LEFT JOIN loan_installments li ON li.transaction_id = t.id
      WHERE t.user_id = :userId
        AND t.account_id = :accountId
        AND (t.date > :date OR (t.date = :date AND t.id > :id))
  `);

  const insertTxStmt = db.prepare(`
      INSERT INTO transactions
      (user_id, account_id, type, amount, description, subcategory_id, date,
       payment_method_id, notes, reimbursement_status, scheduled_id)
      VALUES
          (:userId, :accountId, :type, :amount, :description, :subcategoryId, :date,
           :paymentMethodId, :notes, :reimbursementStatus, :scheduledId)
  `);
  const insertSplitStmt = db.prepare(`
      INSERT INTO transaction_splits (user_id, transaction_id, subcategory_id, amount)
      VALUES (:userId, :txId, :subcategoryId, :amount)
  `);
  const updateTxStmt = db.prepare(`
      UPDATE transactions
      SET account_id        = :accountId,
          type              = :type,
          amount            = :amount,
          description       = :description,
          subcategory_id    = :subcategoryId,
          date              = :date,
          payment_method_id = :paymentMethodId,
          notes             = :notes,
          validated         = :validated
      WHERE id = :id
        AND user_id = :userId
  `);
  const validateTxStmt = db.prepare(`
      UPDATE transactions
      SET validated = :validated
      WHERE user_id = :userId
        AND id IN (:id, (SELECT transfer_peer_id FROM transactions WHERE id = :id))
  `);
  const updateReimbursementStatusStmt = db.prepare(
    `UPDATE transactions SET reimbursement_status = :status WHERE id = :id AND user_id = :userId`,
  );
  const deleteStmt = db.prepare('DELETE FROM transactions WHERE id = :id AND user_id = :userId');
  const deleteSplitsByTxIdStmt = db.prepare(
    'DELETE FROM transaction_splits WHERE transaction_id = :txId',
  );

  // Cache pour les requêtes dynamiques
  const getStatementCache = new Map<string, Statement>();
  const getDynamicStmt = (baseSql: string, filterKeys: string[]) => {
    const sortedKeys = [...filterKeys].sort(collator.compare);
    const cacheKey = baseSql + sortedKeys.join(',');
    if (!getStatementCache.has(cacheKey)) {
      getStatementCache.set(cacheKey, db.prepare(baseSql));
    }
    return getStatementCache.get(cacheKey)!;
  };

  return {
    getCountByCategoryId: (categoryId: number): number =>
      getCountByCategoryIdStmt.get({ categoryId }) ?? 0,
    getCountBySubcategoryId: (subcategoryId: number): number =>
      getCountBySubcategoryIdStmt.get({ subcategoryId }) ?? 0,
    getCountByPaymentMethodId: (paymentMethodId: number): number =>
      getCountByPaymentMethodIdStmt.get({ paymentMethodId }) ?? 0,
    getByUserId(userId: number, filters: TransactionFilters): PaginatedResult<Transaction> {
      const page = Math.max(1, filters.page ?? 1);
      const limit = Math.min(100, Math.max(1, filters.limit ?? 25));

      // Construction des conditions pour Named Parameters
      const conditions: string[] = ['t.user_id = :userId'];
      const params: QueryParams = { userId };

      if (filters.account_id) {
        conditions.push('t.account_id = :account_id');
        params.account_id = filters.account_id;
      }
      if (filters.type) {
        conditions.push('t.type = :type');
        params.type = filters.type;
      }
      if (filters.category_id) {
        conditions.push('sc.category_id = :category_id');
        params.category_id = filters.category_id;
      }
      if (filters.subcategory_id) {
        conditions.push('t.subcategory_id = :subcategory_id');
        params.subcategory_id = filters.subcategory_id;
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const countSql = `SELECT COUNT(*) AS count FROM transactions t
                        LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
                        ${whereClause}`;

      const countStmt = getDynamicStmt(countSql, Object.keys(params));
      const total = (countStmt.get(params) as { count: number }).count;

      if (total === 0) {
        return {
          ...EMPTY_PAGINATED_RESULT,
          balance_before_page: filters.account_id ? 0 : undefined,
        };
      }

      const dataSql = `
        ${TX_WITH_DETAILS}
        ${whereClause}
        GROUP BY t.id
        ORDER BY t.date DESC, t.id DESC
        LIMIT :limit OFFSET :offset`;

      const dataStmt = getDynamicStmt(dataSql, [...Object.keys(params), 'limit', 'offset']);

      const queryArgs: QueryParams = {
        ...params,
        limit,
        offset: (page - 1) * limit,
      };
      const rawRows = dataStmt.all(queryArgs) as TransactionRow[];
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

          const row = getBalanceStmt.get({
            userId,
            accountId: filters.account_id,
            date: firstTx.date,
            id: firstTx.id,
          });
          balance_before_page = row?.sum ?? 0;
        }
      }

      return { data, total, page, totalPages, balance_before_page };
    },

    getById: (id: number, userId: number) => getByIdStmt.get({ id, userId }) ?? undefined,

    getWithDetails(id: number) {
      const row = getByIdWithDetailsStmt.get({ id });
      return row ? parseSplits(row) : undefined;
    },

    create(userId: number, data: CreateTransactionInput) {
      return db.transaction(() => {
        const result = insertTxStmt.run({
          userId,
          accountId: data.account_id,
          type: data.type,
          amount: data.amount,
          description: data.description,
          subcategoryId: data.subcategory_id,
          date: data.date,
          paymentMethodId: data.payment_method_id,
          notes: data.notes,
          reimbursementStatus: data.reimbursement_status ?? null,
          scheduledId: null, // Toujours null pour une transaction manuelle
        });
        if (data.splits?.length) {
          const txId = Number(result.lastInsertRowid);
          for (const s of data.splits) {
            insertSplitStmt.run({
              userId,
              txId,
              subcategoryId: s.subcategory_id,
              amount: s.amount,
            });
          }
        }
        return result;
      })();
    },

    createScheduled(userId: number, data: CreateScheduledTransactionInput): number {
      const result = insertTxStmt.run({
        userId,
        accountId: data.account_id,
        type: data.type,
        amount: data.amount,
        description: data.description,
        subcategoryId: data.subcategory_id,
        date: data.date,
        paymentMethodId: data.payment_method_id,
        notes: data.notes,
        reimbursementStatus: null, // Toujours null pour du récurrent au moment de la génération
        scheduledId: data.scheduled_id,
      });
      return Number(result.lastInsertRowid);
    },

    update(userId: number, id: number, data: CreateTransactionInput) {
      return db.transaction(() => {
        const result = updateTxStmt.run({
          accountId: data.account_id,
          type: data.type,
          amount: data.amount,
          description: data.description,
          subcategoryId: data.subcategory_id,
          date: data.date,
          paymentMethodId: data.payment_method_id,
          notes: data.notes,
          validated: data.validated ? 1 : 0,
          id,
          userId,
        });
        deleteSplitsByTxIdStmt.run({ txId: id });
        if (data.splits?.length) {
          for (const s of data.splits) {
            insertSplitStmt.run({
              userId,
              txId: id,
              subcategoryId: s.subcategory_id,
              amount: s.amount,
            });
          }
        }
        return result;
      })();
    },

    setValidated(userId: number, id: number, validated: boolean) {
      return validateTxStmt.run({
        userId,
        id,
        validated: validated ? 1 : 0,
      });
    },

    setReimbursementStatus: (userId: number, id: number, status: ReimbursementStatus | null) =>
      updateReimbursementStatusStmt.run({ id, userId, status }),

    delete: (userId: number, id: number) => deleteStmt.run({ id, userId }),
  };
}
