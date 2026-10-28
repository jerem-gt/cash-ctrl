import type { Database } from 'better-sqlite3';

import type { ResetTokenRow, User } from './auth.types.js';

export function createAuthRepo(db: Database) {
  const getByUsernameStmt = db.prepare<{ username: string }, User>(
    'SELECT * FROM users WHERE username = :username',
  );
  const getByEmailStmt = db.prepare<{ email: string }, User>(
    'SELECT * FROM users WHERE lower(email) = :email',
  );
  const getByIdStmt = db.prepare<{ id: number }, User>('SELECT * FROM users WHERE id = :id');
  const usernameOwnerStmt = db.prepare<{ username: string }, { id: number }>(
    'SELECT id FROM users WHERE username = :username',
  );
  const emailOwnerStmt = db.prepare<{ email: string }, { id: number }>(
    'SELECT id FROM users WHERE lower(email) = :email',
  );
  const countUsersStmt = db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM users');
  const insertAdminStmt = db.prepare<{ username: string; hash: string }>(
    'INSERT INTO users (username, password_hash, is_admin) VALUES (:username, :hash, 1)',
  );
  const updatePasswordStmt = db.prepare('UPDATE users SET password_hash = :hash WHERE id = :id');
  const updateUsernameStmt = db.prepare('UPDATE users SET username = :username WHERE id = :id');
  const updateEmailStmt = db.prepare('UPDATE users SET email = :email WHERE id = :id');
  const enableTotpStmt = db.prepare(
    'UPDATE users SET totp_secret = :secret, totp_enabled = 1 WHERE id = :id',
  );
  const disableTotpStmt = db.prepare(
    'UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = :id',
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
    getByEmail: (email: string): User | undefined => getByEmailStmt.get({ email }) ?? undefined,
    getById: (id: number): User | undefined => getByIdStmt.get({ id }) ?? undefined,
    /** Id du compte portant ce nom (sensible à la casse, comme la contrainte UNIQUE). */
    usernameOwner: (username: string): number | undefined =>
      usernameOwnerStmt.get({ username })?.id,
    /** Id du compte portant cet e-mail (comparaison insensible à la casse). */
    emailOwner: (email: string): number | undefined =>
      emailOwnerStmt.get({ email: email.toLowerCase() })?.id,
    countUsers: (): number => countUsersStmt.get()?.n ?? 0,
    createAdmin: (username: string, hash: string): number =>
      Number(insertAdminStmt.run({ username, hash }).lastInsertRowid),
    updatePassword: (userId: number, hash: string) => updatePasswordStmt.run({ hash, id: userId }),
    updateUsername: (userId: number, username: string) =>
      updateUsernameStmt.run({ username, id: userId }),
    updateEmail: (userId: number, email: string | null) =>
      updateEmailStmt.run({ email, id: userId }),
    enableTotp: (userId: number, secret: string) => enableTotpStmt.run({ secret, id: userId }),
    disableTotp: (userId: number) => disableTotpStmt.run({ id: userId }),
    deleteResetTokensForUser: (userId: number) => deleteTokensForUserStmt.run(userId),
    purgeExpiredResetTokens: (now: number) => purgeExpiredTokensStmt.run(now),
    insertResetToken: (tokenHash: string, userId: number, expiresAt: number) =>
      insertTokenStmt.run(tokenHash, userId, expiresAt),
    getResetToken: (tokenHash: string): ResetTokenRow | undefined => getTokenStmt.get(tokenHash),
  };
}

export type AuthRepo = ReturnType<typeof createAuthRepo>;
