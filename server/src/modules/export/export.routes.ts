import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, sessionUserId } from '../../middleware.js';
import { createExportRepo } from './export.repo';

export function createExportRouter(db: Database): Router {
  const exportRepo = createExportRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/json-full', (req, res) => {
    const parsed = z.object({ accountIds: z.string().optional() }).safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Paramètres invalides' });
      return;
    }
    const accountIds = parsed.data.accountIds
      ? parsed.data.accountIds
          .split(',')
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0)
      : undefined;

    const userId = sessionUserId(req);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Disposition', `attachment; filename="cashctrl-full-${date}.json"`);
    res.json(exportRepo.getFullExport(userId, accountIds));
  });

  return router;
}
