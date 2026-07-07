import type {
  SearchAccountResult,
  SearchResponse,
  SearchScheduledResult,
  SearchStockResult,
  SearchTransactionResult,
} from '@cashctrl/types';
import type { Database } from 'better-sqlite3';

import { escapeLikeTerm } from '../../lib/sql';

const LIMIT = 8;

const ACCOUNTS_SQL = `
  SELECT a.id, a.name, COALESCE(b.name, '') AS bank, a.closed_at, at.envelope_type
  FROM accounts a
  LEFT JOIN banks b ON a.bank_id = b.id
  LEFT JOIN account_types at ON a.account_type_id = at.id
  WHERE a.user_id = :userId
    AND (
      unaccent(lower(a.name)) LIKE '%' || unaccent(lower(:q)) || '%' ESCAPE '\\'
      OR unaccent(lower(COALESCE(b.name, ''))) LIKE '%' || unaccent(lower(:q)) || '%' ESCAPE '\\'
    )
  ORDER BY a.name COLLATE NOCASE
  LIMIT ${LIMIT}
`;

const TRANSACTIONS_SQL = `
  SELECT t.id, t.description, t.date, t.amount, t.type, t.account_id
  FROM transactions t
  WHERE t.user_id = :userId
    AND (
      unaccent(lower(t.description)) LIKE '%' || unaccent(lower(:q)) || '%' ESCAPE '\\'
      OR unaccent(lower(COALESCE(t.notes, ''))) LIKE '%' || unaccent(lower(:q)) || '%' ESCAPE '\\'
    )
  ORDER BY t.date DESC
  LIMIT ${LIMIT}
`;

const SCHEDULED_SQL = `
  SELECT s.id, s.description, s.amount, s.type, s.active
  FROM scheduled_transactions s
  WHERE s.user_id = :userId
    AND (
      unaccent(lower(s.description)) LIKE '%' || unaccent(lower(:q)) || '%' ESCAPE '\\'
      OR unaccent(lower(COALESCE(s.notes, ''))) LIKE '%' || unaccent(lower(:q)) || '%' ESCAPE '\\'
    )
  ORDER BY s.active DESC, s.description COLLATE NOCASE ASC
  LIMIT ${LIMIT}
`;

const STOCKS_SQL = `
  SELECT sp.id, sp.ticker, sp.account_id
  FROM stock_positions sp
  WHERE sp.user_id = :userId
    AND sp.quantity > 0
    AND unaccent(lower(sp.ticker)) LIKE '%' || unaccent(lower(:q)) || '%' ESCAPE '\\'
  ORDER BY sp.ticker COLLATE NOCASE
  LIMIT ${LIMIT}
`;

export function createSearchRepo(db: Database) {
  const accountsStmt = db.prepare<{ userId: number; q: string }, SearchAccountResult>(ACCOUNTS_SQL);
  const transactionsStmt = db.prepare<{ userId: number; q: string }, SearchTransactionResult>(
    TRANSACTIONS_SQL,
  );
  const scheduledStmt = db.prepare<{ userId: number; q: string }, SearchScheduledResult>(
    SCHEDULED_SQL,
  );
  const stocksStmt = db.prepare<{ userId: number; q: string }, SearchStockResult>(STOCKS_SQL);

  return {
    search: (userId: number, rawQuery: string): SearchResponse => {
      const q = escapeLikeTerm(rawQuery);
      return {
        accounts: accountsStmt.all({ userId, q }),
        transactions: transactionsStmt.all({ userId, q }),
        scheduled: scheduledStmt.all({ userId, q }),
        stocks: stocksStmt.all({ userId, q }),
      };
    },
  };
}
