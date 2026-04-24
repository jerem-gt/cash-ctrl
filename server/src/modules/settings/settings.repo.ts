import type { Database } from 'better-sqlite3';

import type { UserSettings } from './settings.types';

export function createSettingsRepo(db: Database) {
  return {
    get(userId: number): UserSettings {
      let row = db.prepare<[number], UserSettings>('SELECT lead_days FROM user_settings WHERE user_id = ?').get(userId);
      if (!row) {
        db.prepare('INSERT INTO user_settings (user_id, lead_days) VALUES (?, 30)').run(userId);
        row = {lead_days: 30};
      }
      return row;
    },

    upsert(userId: number, leadDays: number) {
      return db.prepare(`
        INSERT INTO user_settings (user_id, lead_days)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET lead_days = excluded.lead_days
      `).run(userId, leadDays);
    },
  };
}
