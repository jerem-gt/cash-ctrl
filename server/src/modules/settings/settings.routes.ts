import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware.js';
import { createSettingsRepo } from './settings.repo';
import type { Database } from 'better-sqlite3';

const settingsSchema = z.object({ lead_days: z.number().int().min(0).max(365) });

export function createSettingsRouter(db: Database): Router {
  const settingsRepo = createSettingsRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    res.json(settingsRepo.get(req.session.userId!));
  });

  router.put('/', (req, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    settingsRepo.upsert(req.session.userId!, parsed.data.lead_days);
    res.json({ lead_days: parsed.data.lead_days });
  });

  return router;
}
