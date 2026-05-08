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
    balance_stocks: toEuros(row.balance_stocks),
    capital_restant_du: row.capital_restant_du != null ? toEuros(row.capital_restant_du) : null,
    capital_restant_du_all:
      row.capital_restant_du_all != null ? toEuros(row.capital_restant_du_all) : null,
  };
}

const BALANCE_SUBQUERY = `
  a.initial_balance + COALESCE(
    (SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)
     FROM transactions t WHERE t.account_id = a.id AND t.validated = 1),
    0
  ) AS balance`;

const BALANCE_ALL_SUBQUERY = `
  a.initial_balance + COALESCE(
    (SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)
     FROM transactions t WHERE t.account_id = a.id),
    0
  ) AS balance_all`;

const BALANCE_STOCKS_SUBQUERY = `
  COALESCE(
    (SELECT SUM(sp.quantity * COALESCE(sprice.price, 0))
     FROM stock_positions sp
     LEFT JOIN stock_prices sprice ON sp.ticker = sprice.ticker
     WHERE sp.account_id = a.id),
    0
  ) AS balance_stocks`;

const CAPITAL_RESTANT_DU_SUBQUERY = `
  (SELECT l.principal_amount - COALESCE(
      (SELECT SUM(li.principal_amount)
       FROM loan_installments li
       INNER JOIN transactions t ON t.id = li.transaction_id
       WHERE li.loan_id = l.id AND t.validated = 1),
      0
   )
   FROM loans l WHERE l.account_id = a.id) AS capital_restant_du`;

const CAPITAL_RESTANT_DU_ALL_SUBQUERY = `
  (SELECT l.principal_amount - COALESCE(
      (SELECT SUM(li.principal_amount)
       FROM loan_installments li
       INNER JOIN transactions t ON t.id = li.transaction_id
       WHERE li.loan_id = l.id),
      0
   )
   FROM loans l WHERE l.account_id = a.id) AS capital_restant_du_all`;

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
         COALESCE(at.is_investment, 0)  AS is_investment,
         COALESCE(at.is_loan, 0)        AS is_loan,
         ${BALANCE_SUBQUERY},
         ${BALANCE_ALL_SUBQUERY},
         ${BALANCE_STOCKS_SUBQUERY},
         ${CAPITAL_RESTANT_DU_SUBQUERY},
         ${CAPITAL_RESTANT_DU_ALL_SUBQUERY}
  FROM accounts a
       LEFT JOIN banks b ON a.bank_id = b.id
       LEFT JOIN account_types at ON a.account_type_id = at.id`;

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
    `${ACCOUNT_SELECT} WHERE a.user_id = :userId ORDER BY a.created_at`,
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
