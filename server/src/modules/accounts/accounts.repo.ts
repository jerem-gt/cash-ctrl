import type { Database } from 'better-sqlite3';

import type {
  Account,
  CloseAccountInput,
  CreateAccountInput,
  UpdateAccountInput,
} from './accounts.types';

const BALANCE_SUBQUERY = `
  a.initial_balance + COALESCE(
    (SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)
     FROM transactions t WHERE t.account_id = a.id),
    0
  ) AS balance`;

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
         ${BALANCE_STOCKS_SUBQUERY},
         ${CAPITAL_RESTANT_DU_SUBQUERY}
  FROM accounts a
       LEFT JOIN banks b ON a.bank_id = b.id
       LEFT JOIN account_types at ON a.account_type_id = at.id`;

export function createAccountsRepo(db: Database) {
  return {
    getByUserId(userId: number): Account[] {
      return db
        .prepare<[number], Account>(`${ACCOUNT_SELECT} WHERE a.user_id = ? ORDER BY a.created_at`)
        .all(userId);
    },

    getById(id: number, userId: number): Account | undefined {
      return (
        db
          .prepare<[number, number], Account>(`${ACCOUNT_SELECT} WHERE a.id = ? AND a.user_id = ?`)
          .get(id, userId) ?? undefined
      );
    },

    create(userId: number, data: CreateAccountInput) {
      return db
        .prepare(
          'INSERT INTO accounts (user_id, name, bank_id, account_type_id, initial_balance, opening_date) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(
          userId,
          data.name,
          data.bank_id,
          data.account_type_id,
          data.initial_balance,
          data.opening_date,
        );
    },

    update(userId: number, id: number, data: UpdateAccountInput) {
      return db
        .prepare(
          'UPDATE accounts SET name = ?, bank_id = ?, account_type_id = ?, initial_balance = ?, opening_date = ? WHERE id = ? AND user_id = ?',
        )
        .run(
          data.name,
          data.bank_id,
          data.account_type_id,
          data.initial_balance,
          data.opening_date,
          id,
          userId,
        );
    },

    delete(userId: number, id: number) {
      return db.prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?').run(id, userId);
    },

    reopen(userId: number, id: number) {
      return db
        .prepare('UPDATE accounts SET closed_at = NULL WHERE id = ? AND user_id = ?')
        .run(id, userId);
    },

    close(userId: number, id: number, data: CloseAccountInput) {
      const account = db
        .prepare<[number, number], { balance: number; name: string }>(
          `SELECT ${BALANCE_SUBQUERY.replace('a.initial_balance', 'a.initial_balance')} , a.name
           FROM accounts a WHERE a.id = ? AND a.user_id = ?`,
        )
        .get(id, userId);

      if (!account) return;

      const balance = Math.round(account.balance * 100) / 100;

      return db.transaction(() => {
        if (balance !== 0 && data.transfer_to_account_id) {
          const transferSubcat = db
            .prepare<[], { id: number }>(`SELECT id FROM subcategories WHERE name = 'Transfert'`)
            .get();
          const transferPm = db
            .prepare<[], { id: number }>(`SELECT id FROM payment_methods WHERE name = 'Transfert'`)
            .get();
          const subcatId = transferSubcat?.id ?? null;
          const pmId = transferPm?.id ?? null;

          const insert = db.prepare(
            'INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, validated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
          );
          const setPeer = db.prepare('UPDATE transactions SET transfer_peer_id = ? WHERE id = ?');
          const description = `Virement de clôture — ${account.name}`;
          const amount = Math.abs(balance);

          const [fromId, toId] =
            balance > 0 ? [id, data.transfer_to_account_id] : [data.transfer_to_account_id, id];

          const expId = Number(
            insert.run(
              userId,
              fromId,
              'expense',
              amount,
              description,
              subcatId,
              data.closed_at,
              pmId,
            ).lastInsertRowid,
          );
          const incId = Number(
            insert.run(userId, toId, 'income', amount, description, subcatId, data.closed_at, pmId)
              .lastInsertRowid,
          );
          setPeer.run(incId, expId);
          setPeer.run(expId, incId);
        }

        db.prepare('UPDATE accounts SET closed_at = ? WHERE id = ? AND user_id = ?').run(
          data.closed_at,
          id,
          userId,
        );
      })();
    },
  };
}
