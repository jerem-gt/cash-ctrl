import type { Database, Statement } from 'better-sqlite3';

import type { SystemRefColumn } from '../../lib/systemEntities';
import type { UserSettings } from './settings.types';

const DEFAULTS: Omit<UserSettings, 'user_id'> = {
  lead_days: 30,
  backup_enabled: 0,
  backup_frequency_h: 24,
  backup_max_files: 7,
  backup_last_at: null,
  backup_last_hash: null,
  financial_income_category_id: null,
  transfer_subcategory_id: null,
  transfer_payment_method_id: null,
  bank_fees_subcategory_id: null,
  social_fees_subcategory_id: null,
  prelevement_payment_method_id: null,
};

export function createSettingsRepo(db: Database) {
  const getByUserIdStmt = db.prepare<{ userId: number }, UserSettings>(
    `SELECT lead_days, backup_enabled, backup_frequency_h, backup_max_files,
            backup_last_at, backup_last_hash,
            financial_income_category_id, transfer_subcategory_id, transfer_payment_method_id,
            bank_fees_subcategory_id, social_fees_subcategory_id, prelevement_payment_method_id
     FROM user_settings WHERE user_id = :userId`,
  );

  const initStmt = db.prepare(`
    INSERT INTO user_settings (user_id, lead_days, backup_enabled, backup_frequency_h, backup_max_files)
    VALUES (:userId, 30, 0, 24, 7)
  `);

  const upsertStmt = db.prepare(`
    INSERT INTO user_settings (user_id, lead_days, backup_enabled, backup_frequency_h, backup_max_files)
    VALUES (:userId, :leadDays, :backupEnabled, :backupFrequencyH, :backupMaxFiles)
    ON CONFLICT(user_id) DO UPDATE SET
      lead_days          = excluded.lead_days,
      backup_enabled     = excluded.backup_enabled,
      backup_frequency_h = excluded.backup_frequency_h,
      backup_max_files   = excluded.backup_max_files,
      updated_at         = CURRENT_TIMESTAMP
  `);

  // Updates backup_last_at only (check done, no new backup created)
  const updateLastAtStmt = db.prepare(`
    INSERT INTO user_settings (user_id, lead_days, backup_enabled, backup_frequency_h, backup_max_files, backup_last_at)
    VALUES (:userId, 30, 0, 24, 7, :lastAt)
    ON CONFLICT(user_id) DO UPDATE SET backup_last_at = excluded.backup_last_at
  `);

  // Updates both backup_last_at and backup_last_hash (new backup was created)
  const updateAfterBackupStmt = db.prepare(`
    INSERT INTO user_settings (user_id, lead_days, backup_enabled, backup_frequency_h, backup_max_files, backup_last_at, backup_last_hash)
    VALUES (:userId, 30, 0, 24, 7, :lastAt, :hash)
    ON CONFLICT(user_id) DO UPDATE SET
      backup_last_at   = excluded.backup_last_at,
      backup_last_hash = excluded.backup_last_hash
  `);

  // Cache des statements de vérification d'appartenance, un par table référencée
  const entityOwnershipStmts = new Map<string, Statement<[number, number], number>>();

  return {
    /** Vérifie qu'un id existe pour l'utilisateur dans la table donnée (table issue d'un allowlist appelant). */
    entityBelongsToUser(table: string, id: number, userId: number): boolean {
      let stmt = entityOwnershipStmts.get(table);
      if (!stmt) {
        stmt = db
          .prepare<[number, number], number>(`SELECT 1 FROM ${table} WHERE id = ? AND user_id = ?`)
          .pluck();
        entityOwnershipStmts.set(table, stmt);
      }
      return stmt.get(id, userId) !== undefined;
    },

    get(userId: number): UserSettings {
      const row = getByUserIdStmt.get({ userId });
      if (!row) {
        initStmt.run({ userId });
        return { ...DEFAULTS };
      }
      return row;
    },

    upsert(
      userId: number,
      data: {
        leadDays: number;
        backupEnabled: boolean;
        backupFrequencyH: number;
        backupMaxFiles: number;
      },
    ) {
      return upsertStmt.run({
        userId,
        leadDays: data.leadDays,
        backupEnabled: data.backupEnabled ? 1 : 0,
        backupFrequencyH: data.backupFrequencyH,
        backupMaxFiles: data.backupMaxFiles,
      });
    },

    updateBackupLastAt(userId: number, lastAt: string) {
      return updateLastAtStmt.run({ userId, lastAt });
    },

    updateAfterBackup(userId: number, lastAt: string, hash: string) {
      return updateAfterBackupStmt.run({ userId, lastAt, hash });
    },

    setSystemRefs(userId: number, refs: Partial<Record<SystemRefColumn, number | null>>) {
      const entries = Object.entries(refs) as Array<[SystemRefColumn, number | null]>;
      if (entries.length === 0) return;

      const colNames = entries.map(([col]) => col).join(', ');
      const colParams = entries.map(([col]) => `:${col}`).join(', ');
      const setClauses = entries.map(([col]) => `${col} = :${col}`).join(', ');
      const params: Record<string, number | null | undefined> = { userId };
      for (const [col, val] of entries) {
        params[col] = val;
      }

      db.prepare(
        `
        INSERT INTO user_settings (user_id, lead_days, backup_enabled, backup_frequency_h, backup_max_files, ${colNames})
        VALUES (:userId, 30, 0, 24, 7, ${colParams})
        ON CONFLICT(user_id) DO UPDATE SET ${setClauses}, updated_at = CURRENT_TIMESTAMP
      `,
      ).run(params);
    },

    updateSystemRefs(userId: number, refs: Partial<Record<SystemRefColumn, number | null>>) {
      const entries = Object.entries(refs) as Array<[SystemRefColumn, number | null]>;
      if (entries.length === 0) return;

      const setClauses = entries.map(([col]) => `${col} = :${col}`).join(', ');
      const params: Record<string, number | null | undefined> = { userId };
      for (const [col, val] of entries) {
        params[col] = val;
      }

      db.prepare(
        `UPDATE user_settings SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE user_id = :userId`,
      ).run(params);
    },
  };
}
