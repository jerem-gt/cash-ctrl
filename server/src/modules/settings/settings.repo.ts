import type { Database } from 'better-sqlite3';

import type { UserSettings } from './settings.types';

const DEFAULTS: Omit<UserSettings, 'user_id'> = {
  lead_days: 30,
  backup_enabled: 0,
  backup_frequency_h: 24,
  backup_max_files: 7,
  backup_last_at: null,
  backup_last_hash: null,
};

export function createSettingsRepo(db: Database) {
  const getByUserIdStmt = db.prepare<{ userId: number }, UserSettings>(
    `SELECT lead_days, backup_enabled, backup_frequency_h, backup_max_files,
            backup_last_at, backup_last_hash
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

  return {
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
  };
}
