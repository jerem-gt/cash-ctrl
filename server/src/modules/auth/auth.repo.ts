import type { Database } from 'better-sqlite3';

import type { User } from './auth.types';

export function createAuthRepo(db: Database) {
  return {
    getByUsername(username: string): User | undefined {
      return db.prepare<[string], User>('SELECT * FROM users WHERE username = ?').get(username) ?? undefined;
    },

    getById(id: number): User | undefined {
      return db.prepare<[number], User>('SELECT * FROM users WHERE id = ?').get(id) ?? undefined;
    },

    updatePassword(userId: number, hash: string) {
      return db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
    },
  };
}
