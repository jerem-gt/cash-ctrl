import type { Database } from 'better-sqlite3';

import type { UserSettings } from './settings.types';

export function createSettingsRepo(db: Database) {
  const getByUserIdStmt = db.prepare<{ userId: number }, UserSettings>(
    'SELECT lead_days FROM user_settings WHERE user_id = :userId',
  );
  const upsertUserSettingsStmt = db.prepare(`
    INSERT INTO user_settings (user_id, lead_days)
    VALUES (:userId, :leadDays)
    ON CONFLICT(user_id) DO UPDATE SET 
      lead_days = excluded.lead_days,
      updated_at = CURRENT_TIMESTAMP
  `);

  return {
    get(userId: number): UserSettings {
      let row = getByUserIdStmt.get({ userId });
      if (!row) {
        upsertUserSettingsStmt.run({ userId, leadDays: 30 });
        row = { lead_days: 30 };
      }
      return row;
    },

    upsert: (userId: number, leadDays: number) => {
      return upsertUserSettingsStmt.run({ userId, leadDays });
    },
  };
}
