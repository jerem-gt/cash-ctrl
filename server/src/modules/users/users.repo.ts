import type { Database } from 'better-sqlite3';

import type { UserPublic } from './users.types';

export function createUsersRepo(db: Database) {
  const listStmt = db.prepare<[], UserPublic>(`
    SELECT
      u.id,
      u.username,
      u.is_admin,
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
  const insertStmt = db.prepare<{ username: string; hash: string }>(
    'INSERT INTO users (username, password_hash, is_admin) VALUES (:username, :hash, 0)',
  );
  const updateUsernameStmt = db.prepare<{ id: number; username: string }>(
    'UPDATE users SET username = :username WHERE id = :id',
  );
  const updatePasswordStmt = db.prepare<{ id: number; hash: string }>(
    'UPDATE users SET password_hash = :hash WHERE id = :id',
  );
  const deleteStmt = db.prepare<{ id: number }>(
    'DELETE FROM users WHERE id = :id AND is_admin = 0',
  );
  const getByIdStmt = db.prepare<{ id: number }, UserPublic>(
    'SELECT id, username, is_admin, created_at FROM users WHERE id = :id',
  );

  return {
    list: (): UserPublic[] => listStmt.all(),
    getById: (id: number): UserPublic | undefined => getByIdStmt.get({ id }) ?? undefined,
    getByUsername: (username: string): { id: number } | undefined =>
      getByUsernameStmt.get({ username }) ?? undefined,
    create: (username: string, hash: string): UserPublic => {
      const result = insertStmt.run({ username, hash });
      return getByIdStmt.get({ id: result.lastInsertRowid as number }) as UserPublic;
    },
    updateUsername: (id: number, username: string) => updateUsernameStmt.run({ id, username }),
    updatePassword: (id: number, hash: string) => updatePasswordStmt.run({ id, hash }),
    remove: (id: number) => deleteStmt.run({ id }),
  };
}
