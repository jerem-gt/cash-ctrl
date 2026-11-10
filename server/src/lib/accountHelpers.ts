import type { Database } from 'better-sqlite3';

import type { ErrorCode } from './errorCodes.js';
import { NotFoundError } from './errors.js';

/** Le compte appartient à l'utilisateur, sinon 404 `code` (`account.not_found` par défaut). */
export function assertOwnedAccount(
  db: Database,
  accountId: number,
  userId: number,
  code: ErrorCode = 'account.not_found',
): void {
  const owned = db
    .prepare('SELECT 1 FROM accounts WHERE id = ? AND user_id = ?')
    .get(accountId, userId);
  if (!owned) {
    throw new NotFoundError(code);
  }
}

export function getAccountEnvelopeType(db: Database, accountId: number): string | null | undefined {
  return db
    .prepare<[number], { envelope_type: string | null }>(
      `SELECT at.envelope_type
       FROM accounts a
       LEFT JOIN account_types at ON a.account_type_id = at.id
       WHERE a.id = ?`,
    )
    .get(accountId)?.envelope_type;
}
