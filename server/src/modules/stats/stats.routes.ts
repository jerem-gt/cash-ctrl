import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { checkAccountOwnership } from '../../lib/accountHelpers.js';
import { dateStr } from '../../lib/dateUtils.js';
import { NotFoundError } from '../../lib/errors.js';
import { parseIdParam } from '../../lib/routeHelpers.js';
import { currentUserId, requireAuth } from '../../middleware.js';
import { createStocksRepo } from '../stocks/stocks.repo.js';
import { fetchAndStorePriceHistory } from '../stocks/stocks.service.js';
import { createAccountBalanceHistoryRepo } from './account-balance-history.repo.js';
import { createForecastRepo } from './forecast.repo.js';
import { createStatsRepo } from './stats.repo.js';

export const forecastQuerySchema = z.object({
  horizon: z.coerce
    .number()
    .int()
    .default(90)
    .refine((v) => v === 30 || v === 90, 'validation.invalid_value'),
  account_id: z.coerce.number().int().positive().optional(),
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

  router.get('/', (_req, res) => {
    const userId = currentUserId(res);
    const today = dateStr(new Date());
    res.json(repo.getDashboardStats(userId, today));
  });

  router.get('/balance-history', (_req, res) => {
    const userId = currentUserId(res);
    res.json(repo.getBalanceHistory(userId));
  });

  router.get('/report-years', (_req, res) => {
    const userId = currentUserId(res);
    res.json(repo.getReportYears(userId));
  });

  router.get('/report', (req, res) => {
    const userId = currentUserId(res);
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
    const userId = currentUserId(res);
    const query = forecastQuerySchema.parse(req.query);
    const { account_id: accountId } = query;
    if (accountId !== undefined && !checkAccountOwnership(db, accountId, userId)) {
      throw new NotFoundError('account.not_found');
    }
    const today = dateStr(new Date());
    res.json(forecastRepo.getForecast(userId, query.horizon, today, accountId));
  });

  router.get('/accounts/:accountId/balance-history', (req, res) => {
    const userId = currentUserId(res);
    const accountId = parseIdParam(req, 'accountId');
    const query = accountBalanceHistoryQuerySchema.parse(req.query);
    if (!checkAccountOwnership(db, accountId, userId)) {
      throw new NotFoundError('account.not_found');
    }
    const today = dateStr(new Date());
    res.json(accountBalanceHistoryRepo.getBalanceHistory(accountId, query.days, today));
  });

  router.get('/profitability', async (_req, res) => {
    const userId = currentUserId(res);
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
