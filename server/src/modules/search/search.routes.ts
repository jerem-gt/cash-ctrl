import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { currentUserId, requireAuth } from '../../middleware.js';
import { createSearchRepo } from './search.repo.js';

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2),
});

export function createSearchRouter(db: Database): Router {
  const repo = createSearchRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const userId = currentUserId(res);
    const query = searchQuerySchema.parse(req.query);
    res.json(repo.search(userId, query.q));
  });

  return router;
}
