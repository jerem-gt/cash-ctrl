import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import { generateScheduledTransactions } from '../../lib/generateScheduled.js';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createStatsRepo } from './stats.repo';

export function createStatsRouter(db: Database): Router {
  const repo = createStatsRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const userId = sessionUserId(req);
    generateScheduledTransactions(userId, db);

    const today = new Date().toISOString().slice(0, 10);
    res.json(repo.getDashboardStats(userId, today));
  });

  router.get('/balance-history', (req, res) => {
    const userId = sessionUserId(req);
    res.json(repo.getBalanceHistory(userId));
  });

  return router;
}
