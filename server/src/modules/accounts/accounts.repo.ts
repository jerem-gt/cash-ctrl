import type { Database } from 'better-sqlite3';

import { toCents, toEuros } from '../../lib/money';
import type {
  Account,
  CloseAccountInput,
  CreateAccountInput,
  UpdateAccountInput,
} from './accounts.types';

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
    SELECT account_id, SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS s
    FROM transactions WHERE validated = 1 GROUP BY account_id
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

export function createAccountsRepo(db: Database) {
  const existsStmt = db.prepare('SELECT 1 FROM accounts WHERE id = :id AND user_id = :userId');
  const getCountByAccountTypeIdStmt = db
    .prepare<
      { accountTypeId: number },
      number
    >('SELECT COUNT(*) as cnt FROM accounts WHERE account_type_id = :accountTypeId')
    .pluck();
  const getCountByBankIdStmt = db
    .prepare<
      { bankId: number },
      number
    >('SELECT COUNT(*) as cnt FROM accounts WHERE bank_id = :bankId')
    .pluck();
  const getByUserIdStmt = db.prepare<{ userId: number }, Account>(
    `${ACCOUNT_SELECT} WHERE a.user_id = :userId ORDER BY a.name COLLATE NOCASE`,
  );
  const getByIdStmt = db.prepare<{ id: number; userId: number }, Account>(
    `${ACCOUNT_SELECT} WHERE a.id = :id AND a.user_id = :userId`,
  );

  const createStmt = db.prepare(
    'INSERT INTO accounts (user_id, name, bank_id, account_type_id, initial_balance, opening_date) VALUES (:user_id, :name, :bank_id, :account_type_id, :initial_balance, :opening_date)',
  );
  const updateStmt = db.prepare(
    'UPDATE accounts SET name = :name, bank_id = :bank_id, account_type_id = :account_type_id, initial_balance = :initial_balance, opening_date = :opening_date WHERE id = :id AND user_id = :user_id',
  );
  const updateClosedAtStmt = db.prepare(
    'UPDATE accounts SET closed_at = :closedAt WHERE id = :id AND user_id = :userId',
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

    close: (userId: number, id: number, data: CloseAccountInput) =>
      updateClosedAtStmt.run({
        closedAt: data.closed_at,
        id,
        userId,
      }),
  };
}
