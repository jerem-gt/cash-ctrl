import type { Database } from 'better-sqlite3';

import type { ResetTokenRow, User } from './auth.types.js';

export function createAuthRepo(db: Database) {
  const getByUsernameStmt = db.prepare<{ username: string }, User>(
    'SELECT * FROM users WHERE username = :username',
  );
  const getByIdStmt = db.prepare<{ id: number }, User>('SELECT * FROM users WHERE id = :id');
  const countUsersStmt = db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM users');
  const insertAdminStmt = db.prepare<{ username: string; hash: string }>(
    'INSERT INTO users (username, password_hash, is_admin) VALUES (:username, :hash, 1)',
  );
  const updatePasswordStmt = db.prepare('UPDATE users SET password_hash = :hash WHERE id = :id');
  const enableTotpStmt = db.prepare(
    'UPDATE users SET totp_secret = :secret, totp_enabled = 1 WHERE id = :id',
  );
  const deleteTokensForUserStmt = db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?');
  const purgeExpiredTokensStmt = db.prepare(
    'DELETE FROM password_reset_tokens WHERE expires_at <= ?',
  );
  const insertTokenStmt = db.prepare(
    'INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
  );
  const getTokenStmt = db.prepare<[string], ResetTokenRow>(
    'SELECT user_id, expires_at FROM password_reset_tokens WHERE token_hash = ?',
  );

  return {
    getByUsername: (username: string): User | undefined =>
      getByUsernameStmt.get({ username }) ?? undefined,
    getById: (id: number): User | undefined => getByIdStmt.get({ id }) ?? undefined,
    countUsers: (): number => countUsersStmt.get()?.n ?? 0,
    createAdmin: (username: string, hash: string): number =>
      Number(insertAdminStmt.run({ username, hash }).lastInsertRowid),
    updatePassword: (userId: number, hash: string) => updatePasswordStmt.run({ hash, id: userId }),
    enableTotp: (userId: number, secret: string) => enableTotpStmt.run({ secret, id: userId }),
    deleteResetTokensForUser: (userId: number) => deleteTokensForUserStmt.run(userId),
    purgeExpiredResetTokens: (now: number) => purgeExpiredTokensStmt.run(now),
    insertResetToken: (tokenHash: string, userId: number, expiresAt: number) =>
      insertTokenStmt.run(tokenHash, userId, expiresAt),
    getResetToken: (tokenHash: string): ResetTokenRow | undefined => getTokenStmt.get(tokenHash),
  };
}

export type AuthRepo = ReturnType<typeof createAuthRepo>;
