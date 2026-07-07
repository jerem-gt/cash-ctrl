import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { checkAccountOwnership } from '../../lib/accountHelpers';
import { dateStr } from '../../lib/dateUtils';
import { parseNumberParam, sendError, zodToApiError } from '../../lib/routeHelpers';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createStocksRepo } from '../stocks/stocks.repo';
import { fetchAndStorePriceHistory } from '../stocks/stocks.service';
import { createAccountBalanceHistoryRepo } from './account-balance-history.repo';
import { createForecastRepo } from './forecast.repo';
import { createStatsRepo } from './stats.repo';

export const forecastQuerySchema = z.object({
  horizon: z.coerce
    .number()
    .int()
    .default(90)
    .refine((v) => v === 30 || v === 90, 'validation.invalid_value'),
});

export const accountBalanceHistoryQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .default(90)
    .refine((v) => v === 30 || v === 90 || v === 365, 'validation.invalid_value'),
});

export function createStatsRouter(db: Database): Router {
  const repo = createStatsRepo(db);
  const stocksRepo = createStocksRepo(db);
  const forecastRepo = createForecastRepo(db);
  const accountBalanceHistoryRepo = createAccountBalanceHistoryRepo(db);
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

  router.get('/report-years', (req, res) => {
    const userId = sessionUserId(req);
    res.json(repo.getReportYears(userId));
  });

  router.get('/report', (req, res) => {
    const userId = sessionUserId(req);
    const yearParam = typeof req.query.year === 'string' ? req.query.year : undefined;
    const year = yearParam ? Number.parseInt(yearParam, 10) : new Date().getFullYear();
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      res.status(400).json({ error: 'Invalid year' });
      return;
    }
    const accountIdParam =
      typeof req.query.account_id === 'string' ? req.query.account_id : undefined;
    const rawAccountId = accountIdParam ? Number.parseInt(accountIdParam, 10) : undefined;
    const accountId =
      rawAccountId !== undefined && !Number.isNaN(rawAccountId) ? rawAccountId : undefined;
    res.json(repo.getReport(userId, year, accountId));
  });

  router.get('/forecast', (req, res) => {
    const userId = sessionUserId(req);
    const parsed = forecastQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: zodToApiError(parsed.error) });
      return;
    }
    const today = dateStr(new Date());
    res.json(forecastRepo.getForecast(userId, parsed.data.horizon, today));
  });

  router.get('/accounts/:accountId/balance-history', (req, res) => {
    const userId = sessionUserId(req);
    const accountId = parseNumberParam(req, res, 'accountId');
    if (accountId === null) return;
    const parsed = accountBalanceHistoryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: zodToApiError(parsed.error) });
      return;
    }
    if (!checkAccountOwnership(db, accountId, userId)) {
      sendError(res, 404, 'account.not_found');
      return;
    }
    const today = dateStr(new Date());
    res.json(accountBalanceHistoryRepo.getBalanceHistory(accountId, parsed.data.days, today));
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
