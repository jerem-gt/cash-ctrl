import type { Database } from 'better-sqlite3';

import type { User } from './auth.types';

export function createAuthRepo(db: Database) {
  const getByUsernameStmt = db.prepare<{ username: string }, User>(
    'SELECT * FROM users WHERE username = :username',
  );
  const getByIdStmt = db.prepare<{ id: number }, User>('SELECT * FROM users WHERE id = :id');
  const updatePasswordStmt = db.prepare('UPDATE users SET password_hash = :hash WHERE id = :id');

  return {
    getByUsername: (username: string): User | undefined =>
      getByUsernameStmt.get({ username }) ?? undefined,
    getById: (id: number): User | undefined => getByIdStmt.get({ id }) ?? undefined,
    updatePassword: (userId: number, hash: string) => updatePasswordStmt.run({ hash, id: userId }),
  };
}
