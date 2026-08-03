import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { zodToApiError } from '../../lib/routeHelpers.js';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createSearchRepo } from './search.repo.js';

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2),
});

export function createSearchRouter(db: Database): Router {
  const repo = createSearchRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const userId = sessionUserId(req);
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: zodToApiError(parsed.error) });
      return;
    }
    res.json(repo.search(userId, parsed.data.q));
  });

  return router;
}
