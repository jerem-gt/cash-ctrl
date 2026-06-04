import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { dateStr } from '../../lib/dateUtils';
import { sendError } from '../../lib/routeHelpers';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createExportRepo } from './export.repo';

export function createExportRouter(db: Database): Router {
  const exportRepo = createExportRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/json-full', (req, res) => {
    const parsed = z.object({ accountIds: z.string().optional() }).safeParse(req.query);
    if (!parsed.success) {
      sendError(res, 400, 'common.invalid_request');
      return;
    }
    const accountIds = parsed.data.accountIds
      ? parsed.data.accountIds
          .split(',')
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0)
      : undefined;

    const userId = sessionUserId(req);
    const date = dateStr(new Date());
    res.setHeader('Content-Disposition', `attachment; filename="cashctrl-full-${date}.json"`);
    res.json(exportRepo.getFullExport(userId, accountIds));
  });

  return router;
}
