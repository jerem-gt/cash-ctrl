import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { parseBody } from '../../lib/routeHelpers';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createSettingsRepo } from './settings.repo';

const settingsSchema = z.object({
  lead_days: z.number().int().min(0).max(365),
  backup_enabled: z.boolean(),
  backup_frequency_h: z.number().int().min(1).max(8760),
  backup_max_files: z.number().int().min(1).max(100),
});

export function createSettingsRouter(db: Database): Router {
  const settingsRepo = createSettingsRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const s = settingsRepo.get(sessionUserId(req));
    res.json({
      lead_days: s.lead_days,
      backup_enabled: s.backup_enabled === 1,
      backup_frequency_h: s.backup_frequency_h,
      backup_max_files: s.backup_max_files,
      backup_last_at: s.backup_last_at,
    });
  });

  router.put('/', (req, res) => {
    const data = parseBody(res, settingsSchema, req.body);
    if (!data) return;
    const userId = sessionUserId(req);
    const { lead_days, backup_enabled, backup_frequency_h, backup_max_files } = data;
    settingsRepo.upsert(userId, {
      leadDays: lead_days,
      backupEnabled: backup_enabled,
      backupFrequencyH: backup_frequency_h,
      backupMaxFiles: backup_max_files,
    });
    const u = settingsRepo.get(userId);
    res.json({
      lead_days: u.lead_days,
      backup_enabled: u.backup_enabled === 1,
      backup_frequency_h: u.backup_frequency_h,
      backup_max_files: u.backup_max_files,
      backup_last_at: u.backup_last_at,
    });
  });

  return router;
}
