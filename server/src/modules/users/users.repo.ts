import type { Database } from 'better-sqlite3';

import type { UserPublic } from './users.types.js';

export function createUsersRepo(db: Database) {
  const listStmt = db.prepare<[], UserPublic>(`
    SELECT
      u.id,
      u.username,
      u.email,
      u.is_admin,
      u.totp_enabled,
      u.created_at,
      COUNT(DISTINCT a.id)  AS account_count,
      COUNT(DISTINCT t.id)  AS tx_count,
      MAX(t.date)           AS last_tx_date
    FROM users u
    LEFT JOIN accounts     a ON a.user_id = u.id
    LEFT JOIN transactions t ON t.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at ASC
  `);
  const getByUsernameStmt = db.prepare<{ username: string }, { id: number }>(
    'SELECT id FROM users WHERE username = :username',
  );
  const getByEmailStmt = db.prepare<{ email: string }, { id: number }>(
    'SELECT id FROM users WHERE lower(email) = :email',
  );
  const insertStmt = db.prepare<{ username: string; hash: string; email: string | null }>(
    'INSERT INTO users (username, password_hash, email, is_admin) VALUES (:username, :hash, :email, 0)',
  );
  const updateUsernameStmt = db.prepare<{ id: number; username: string }>(
    'UPDATE users SET username = :username WHERE id = :id',
  );
  const updateEmailStmt = db.prepare<{ id: number; email: string | null }>(
    'UPDATE users SET email = :email WHERE id = :id',
  );
  const updateAdminStmt = db.prepare<{ id: number; isAdmin: number }>(
    'UPDATE users SET is_admin = :isAdmin WHERE id = :id',
  );
  const updatePasswordStmt = db.prepare<{ id: number; hash: string }>(
    'UPDATE users SET password_hash = :hash WHERE id = :id',
  );
  const disableTotpStmt = db.prepare<{ id: number }>(
    'UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = :id',
  );
  const countAdminsStmt = db.prepare<[], { n: number }>(
    'SELECT COUNT(*) AS n FROM users WHERE is_admin = 1',
  );
  const deleteStmt = db.prepare<{ id: number }>('DELETE FROM users WHERE id = :id');
  const getByIdStmt = db.prepare<{ id: number }, UserPublic>(
    'SELECT id, username, email, is_admin, totp_enabled, created_at FROM users WHERE id = :id',
  );

  return {
    list: (): UserPublic[] => listStmt.all(),
    getById: (id: number): UserPublic | undefined => getByIdStmt.get({ id }) ?? undefined,
    getByUsername: (username: string): { id: number } | undefined =>
      getByUsernameStmt.get({ username }) ?? undefined,
    /** `email` doit être normalisé (emailSchema : trim + minuscules). */
    getByEmail: (email: string): { id: number } | undefined =>
      getByEmailStmt.get({ email }) ?? undefined,
    countAdmins: (): number => countAdminsStmt.get()?.n ?? 0,
    create: (username: string, hash: string, email: string | null = null): UserPublic => {
      const result = insertStmt.run({ username, hash, email });
      return getByIdStmt.get({ id: result.lastInsertRowid as number }) as UserPublic;
    },
    updateUsername: (id: number, username: string) => updateUsernameStmt.run({ id, username }),
    updateEmail: (id: number, email: string | null) => updateEmailStmt.run({ id, email }),
    updateAdmin: (id: number, isAdmin: boolean) =>
      updateAdminStmt.run({ id, isAdmin: isAdmin ? 1 : 0 }),
    updatePassword: (id: number, hash: string) => updatePasswordStmt.run({ id, hash }),
    disableTotp: (id: number) => disableTotpStmt.run({ id }),
    remove: (id: number) => deleteStmt.run({ id }),
  };
}
