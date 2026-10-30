import type { Database } from 'better-sqlite3';

import type { ResetTokenRow, TrustedDeviceRow, User } from './auth.types.js';

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
    'UPDATE users SET totp_secret = :secret, totp_enabled = 1, totp_last_step = :step WHERE id = :id',
  );
  // Conditionnel : de deux requêtes simultanées avec le même code, une seule passe.
  const consumeTotpStepStmt = db.prepare(
    `UPDATE users SET totp_last_step = :step
     WHERE id = :id AND (totp_last_step IS NULL OR totp_last_step < :step)`,
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

  const purgeExpiredDevicesStmt = db.prepare('DELETE FROM trusted_devices WHERE expires_at <= ?');
  const insertDeviceStmt = db.prepare(
    `INSERT INTO trusted_devices (user_id, token_hash, label, created_at, last_used_at, expires_at)
     VALUES (:userId, :tokenHash, :label, :now, :now, :expiresAt)`,
  );
  const getDeviceByHashStmt = db.prepare<[string], TrustedDeviceRow>(
    'SELECT * FROM trusted_devices WHERE token_hash = ?',
  );
  const touchDeviceStmt = db.prepare('UPDATE trusted_devices SET last_used_at = ? WHERE id = ?');
  const deleteDeviceByHashStmt = db.prepare('DELETE FROM trusted_devices WHERE token_hash = ?');
  const listDevicesStmt = db.prepare<[number, number], TrustedDeviceRow>(
    `SELECT * FROM trusted_devices WHERE user_id = ? AND expires_at > ?
     ORDER BY last_used_at DESC, id DESC`,
  );
  const getDeviceStmt = db.prepare<[number, number], TrustedDeviceRow>(
    'SELECT * FROM trusted_devices WHERE id = ? AND user_id = ?',
  );
  const deleteDeviceStmt = db.prepare('DELETE FROM trusted_devices WHERE id = ? AND user_id = ?');

  return {
    purgeExpiredDevices: (now: number) => purgeExpiredDevicesStmt.run(now),
    insertDevice: (
      userId: number,
      tokenHash: string,
      label: string,
      now: number,
      expiresAt: number,
    ) => insertDeviceStmt.run({ userId, tokenHash, label, now, expiresAt }),
    getDeviceByHash: (tokenHash: string): TrustedDeviceRow | undefined =>
      getDeviceByHashStmt.get(tokenHash),
    touchDevice: (id: number, now: number) => touchDeviceStmt.run(now, id),
    deleteDeviceByHash: (tokenHash: string) => deleteDeviceByHashStmt.run(tokenHash),
    listDevices: (userId: number, now: number): TrustedDeviceRow[] =>
      listDevicesStmt.all(userId, now),
    getDevice: (id: number, userId: number): TrustedDeviceRow | undefined =>
      getDeviceStmt.get(id, userId),
    deleteDevice: (id: number, userId: number) => deleteDeviceStmt.run(id, userId),
    getByUsername: (username: string): User | undefined =>
      getByUsernameStmt.get({ username }) ?? undefined,
    getById: (id: number): User | undefined => getByIdStmt.get({ id }) ?? undefined,
    countUsers: (): number => countUsersStmt.get()?.n ?? 0,
    createAdmin: (username: string, hash: string): number =>
      Number(insertAdminStmt.run({ username, hash }).lastInsertRowid),
    updatePassword: (userId: number, hash: string) => updatePasswordStmt.run({ hash, id: userId }),
    /** Le pas du code de confirmation est consommé : ce code ne sert pas à se connecter. */
    enableTotp: (userId: number, secret: string, step: number) =>
      enableTotpStmt.run({ secret, step, id: userId }),
    /** Vrai si le pas est postérieur au dernier accepté, qu'il remplace ; faux pour un rejeu. */
    consumeTotpStep: (userId: number, step: number): boolean =>
      consumeTotpStepStmt.run({ step, id: userId }).changes === 1,
    deleteResetTokensForUser: (userId: number) => deleteTokensForUserStmt.run(userId),
    purgeExpiredResetTokens: (now: number) => purgeExpiredTokensStmt.run(now),
    insertResetToken: (tokenHash: string, userId: number, expiresAt: number) =>
      insertTokenStmt.run(tokenHash, userId, expiresAt),
    getResetToken: (tokenHash: string): ResetTokenRow | undefined => getTokenStmt.get(tokenHash),
  };
}

export type AuthRepo = ReturnType<typeof createAuthRepo>;
