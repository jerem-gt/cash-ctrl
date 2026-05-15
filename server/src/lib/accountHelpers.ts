import type { Database } from 'better-sqlite3';

export function checkAccountOwnership(db: Database, accountId: number, userId: number): boolean {
  return !!db
    .prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?')
    .get(accountId, userId);
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
