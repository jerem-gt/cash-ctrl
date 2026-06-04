import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import { dateStr } from '../../lib/dateUtils';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createStocksRepo } from '../stocks/stocks.repo';
import { fetchAndStorePriceHistory } from '../stocks/stocks.service';
import { createStatsRepo } from './stats.repo';

export function createStatsRouter(db: Database): Router {
  const repo = createStatsRepo(db);
  const stocksRepo = createStocksRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const userId = sessionUserId(req);
    const today = dateStr(new Date());
    res.json(repo.getDashboardStats(userId, today));
  });

  router.get('/balance-history', (req, res) => {
    const userId = sessionUserId(req);
    res.json(repo.getBalanceHistory(userId));
  });

  router.get('/profitability', async (req, res) => {
    const userId = sessionUserId(req);
    const tickers = stocksRepo.getTickersForUser(userId);
    await Promise.all(
      tickers
        .filter((t) => !stocksRepo.hasPriceHistory(t))
        .map((t) => fetchAndStorePriceHistory(stocksRepo, t)),
    );
    res.json(repo.getProfitability(userId));
  });

  return router;
}
