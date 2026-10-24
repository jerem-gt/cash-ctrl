import type { FrequentTransaction } from '@cashctrl/types';
import type { Database } from 'better-sqlite3';

import { toCents, toEuros } from '../../lib/money.js';
import { VALIDATED_TX_SUM_SELECT } from '../../lib/sql.js';
import type {
  Account,
  CloseAccountInput,
  CreateAccountInput,
  UpdateAccountInput,
} from './accounts.types.js';

function mapAccount(row: Account): Account {
  return {
    ...row,
    initial_balance: toEuros(row.initial_balance),
    balance: toEuros(row.balance),
    balance_all: toEuros(row.balance_all),
    balance_stocks: row.balance_stocks,
    balance_insurance: row.balance_insurance,
    capital_restant_du: row.capital_restant_du == null ? null : toEuros(row.capital_restant_du),
    capital_restant_du_all:
      row.capital_restant_du_all == null ? null : toEuros(row.capital_restant_du_all),
  };
}

const ACCOUNT_SELECT = `
  SELECT a.id,
         a.user_id,
         a.name,
         a.bank_id,
         a.account_type_id,
         a.initial_balance,
         a.opening_date,
         a.closed_at,
         a.favorite_order,
         a.created_at,
         COALESCE(b.name, '')           AS bank,
         COALESCE(at.name, '')          AS type,
         at.envelope_type               AS envelope_type,
         a.initial_balance + COALESCE(bal.s, 0)     AS balance,
         a.initial_balance + COALESCE(bal_all.s, 0) AS balance_all,
         COALESCE(stocks.s, 0)                      AS balance_stocks,
         COALESCE(ins.s, 0)                         AS balance_insurance,
         l.principal_amount - COALESCE(inst_val.s, 0)  AS capital_restant_du,
         l.principal_amount - COALESCE(inst_all.s, 0)  AS capital_restant_du_all
  FROM accounts a
  LEFT JOIN banks b ON a.bank_id = b.id
  LEFT JOIN account_types at ON a.account_type_id = at.id
  LEFT JOIN (
    ${VALIDATED_TX_SUM_SELECT} GROUP BY account_id
  ) bal ON bal.account_id = a.id
  LEFT JOIN (
    SELECT account_id, SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS s
    FROM transactions GROUP BY account_id
  ) bal_all ON bal_all.account_id = a.id
  LEFT JOIN (
    SELECT sp.account_id, SUM(sp.quantity * COALESCE(sprice.price, 0)) AS s
    FROM stock_positions sp
    LEFT JOIN stock_prices sprice ON sp.ticker = sprice.ticker
    GROUP BY sp.account_id
  ) stocks ON stocks.account_id = a.id
  LEFT JOIN (
    SELECT account_id,
           SUM((CASE WHEN type IN ('versement', 'arbitrage_in', 'interets', 'revalorisation')
                     THEN amount ELSE -amount END) - fees - social_fees) * 1.0 / 100 AS s
    FROM insurance_operations GROUP BY account_id
  ) ins ON ins.account_id = a.id
  LEFT JOIN loans l ON l.account_id = a.id
  LEFT JOIN (
    SELECT li.loan_id, SUM(li.principal_amount) AS s
    FROM loan_installments li
    INNER JOIN transactions t ON t.id = li.transaction_id AND t.validated = 1
    GROUP BY li.loan_id
  ) inst_val ON inst_val.loan_id = l.id
  LEFT JOIN (
    SELECT li.loan_id, SUM(li.principal_amount) AS s
    FROM loan_installments li
    INNER JOIN transactions t ON t.id = li.transaction_id
    GROUP BY li.loan_id
  ) inst_all ON inst_all.loan_id = l.id`;

const FREQUENT_TX_MONTHS = 6;
const FREQUENT_TX_MIN_COUNT = 2;
const FREQUENT_TX_LIMIT = 5;

export function createAccountsRepo(db: Database) {
  const existsStmt = db.prepare('SELECT 1 FROM accounts WHERE id = :id AND user_id = :userId');
  const getCountByAccountTypeIdStmt = db
    .prepare<{ accountTypeId: number }, number>(
      'SELECT COUNT(*) as cnt FROM accounts WHERE account_type_id = :accountTypeId',
    )
    .pluck();
  const getCountByBankIdStmt = db
    .prepare<{ bankId: number }, number>(
      'SELECT COUNT(*) as cnt FROM accounts WHERE bank_id = :bankId',
    )
    .pluck();
  const getByUserIdStmt = db.prepare<{ userId: number }, Account>(
    `${ACCOUNT_SELECT} WHERE a.user_id = :userId ORDER BY a.name COLLATE NOCASE`,
  );
  const getByIdStmt = db.prepare<{ id: number; userId: number }, Account>(
    `${ACCOUNT_SELECT} WHERE a.id = :id AND a.user_id = :userId`,
  );

  const frequentTransactionsStmt = db.prepare<
    { accountId: number; userId: number; months: string; minCount: number; limit: number },
    FrequentTransaction
  >(`
    WITH base AS (
      SELECT t.id, t.type, TRIM(t.description) AS description, sc.category_id,
             t.subcategory_id, t.payment_method_id, t.date
      FROM transactions t
      JOIN subcategories sc ON sc.id = t.subcategory_id
      WHERE t.account_id = :accountId
        AND t.user_id = :userId
        AND t.date >= date('now', :months)
        AND t.date <= date('now')
        AND t.transfer_peer_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM user_settings us
          WHERE us.user_id = t.user_id
            AND (us.transfer_payment_method_id = t.payment_method_id
                 OR us.transfer_subcategory_id = t.subcategory_id)
        )
        AND t.scheduled_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM transaction_splits s WHERE s.transaction_id = t.id)
    ),
    ranked AS (
      SELECT *,
             COUNT(*) OVER w AS count,
             ROW_NUMBER() OVER (w ORDER BY date DESC, id DESC) AS rn
      FROM base
      WINDOW w AS (PARTITION BY type, LOWER(description), subcategory_id, payment_method_id)
    )
    SELECT type, description, category_id, subcategory_id, payment_method_id, count,
           date AS last_date
    FROM ranked
    WHERE rn = 1 AND count >= :minCount
    ORDER BY count DESC, date DESC, id DESC
    LIMIT :limit`);

  const createStmt = db.prepare(
    'INSERT INTO accounts (user_id, name, bank_id, account_type_id, initial_balance, opening_date) VALUES (:user_id, :name, :bank_id, :account_type_id, :initial_balance, :opening_date)',
  );
  const updateStmt = db.prepare(
    'UPDATE accounts SET name = :name, bank_id = :bank_id, account_type_id = :account_type_id, initial_balance = :initial_balance, opening_date = :opening_date WHERE id = :id AND user_id = :user_id',
  );
  const updateClosedAtStmt = db.prepare(
    'UPDATE accounts SET closed_at = :closedAt WHERE id = :id AND user_id = :userId',
  );
  const closeStmt = db.prepare(
    'UPDATE accounts SET closed_at = :closedAt, favorite_order = NULL WHERE id = :id AND user_id = :userId',
  );
  const maxFavoriteOrderStmt = db
    .prepare<{ userId: number }, number>(
      'SELECT COALESCE(MAX(favorite_order), -1) FROM accounts WHERE user_id = :userId',
    )
    .pluck();
  const activeFavoriteIdsStmt = db
    .prepare<{ userId: number }, number>(
      'SELECT id FROM accounts WHERE user_id = :userId AND favorite_order IS NOT NULL AND closed_at IS NULL',
    )
    .pluck();
  const setFavoriteOrderStmt = db.prepare(
    'UPDATE accounts SET favorite_order = :favoriteOrder WHERE id = :id AND user_id = :userId',
  );
  const reorderFavoriteStmt = db.prepare(
    'UPDATE accounts SET favorite_order = :favoriteOrder WHERE id = :id AND user_id = :userId AND favorite_order IS NOT NULL AND closed_at IS NULL',
  );
  const deleteStmt = db.prepare('DELETE FROM accounts WHERE id = :id AND user_id = :userId');

  return {
    exists: (id: number, userId: number) => !!existsStmt.get({ id, userId }),
    countByAccountTypeId: (accountTypeId: number): number =>
      getCountByAccountTypeIdStmt.get({ accountTypeId }) ?? 0,
    countByBankId: (bankId: number): number => getCountByBankIdStmt.get({ bankId }) ?? 0,

    getByUserId: (userId: number): Account[] => getByUserIdStmt.all({ userId }).map(mapAccount),

    getById: (id: number, userId: number): Account | undefined => {
      const row = getByIdStmt.get({ id, userId });
      return row ? mapAccount(row) : undefined;
    },

    create: (userId: number, data: CreateAccountInput) =>
      createStmt.run({
        ...data,
        initial_balance: toCents(data.initial_balance),
        user_id: userId,
      }),

    update: (userId: number, id: number, data: UpdateAccountInput) =>
      updateStmt.run({
        ...data,
        initial_balance: toCents(data.initial_balance),
        id,
        user_id: userId,
      }),

    delete: (userId: number, id: number) => deleteStmt.run({ userId, id }),

    reopen: (userId: number, id: number) =>
      updateClosedAtStmt.run({
        closedAt: null,
        id,
        userId,
      }),

    setFavorite: (userId: number, id: number, favorite: boolean) => {
      if (!favorite) {
        setFavoriteOrderStmt.run({ favoriteOrder: null, id, userId });
        return;
      }
      const current = getByIdStmt.get({ id, userId });
      if (current?.favorite_order !== null) return;
      const next = (maxFavoriteOrderStmt.get({ userId }) ?? -1) + 1;
      setFavoriteOrderStmt.run({ favoriteOrder: next, id, userId });
    },

    getFrequentTransactions: (userId: number, accountId: number): FrequentTransaction[] =>
      frequentTransactionsStmt.all({
        accountId,
        userId,
        months: `-${FREQUENT_TX_MONTHS} months`,
        minCount: FREQUENT_TX_MIN_COUNT,
        limit: FREQUENT_TX_LIMIT,
      }),

    getActiveFavoriteIds: (userId: number): number[] => activeFavoriteIdsStmt.all({ userId }),

    reorderFavorites: db.transaction(
      (userId: number, items: { id: number; favorite_order: number }[]) => {
        for (const item of items) {
          reorderFavoriteStmt.run({ favoriteOrder: item.favorite_order, id: item.id, userId });
        }
      },
    ),

    close: (userId: number, id: number, data: CloseAccountInput) =>
      closeStmt.run({
        closedAt: data.closed_at,
        id,
        userId,
      }),
  };
}
