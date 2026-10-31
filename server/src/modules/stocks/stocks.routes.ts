import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors.js';
import { createAccountActionHandler } from '../../lib/handleAccountAction.js';
import { makeCheckAccount, parseIdParam } from '../../lib/routeHelpers.js';
import {
  dateSchema,
  descriptionSchema,
  feesSchema,
  positiveAmountSchema,
} from '../../lib/validators.js';
import { currentUserId, requireAuth } from '../../middleware.js';
import { createStocksRepo } from './stocks.repo.js';
import { getOrRefreshPrice, refreshUserPrices, searchByQuery } from './stocks.service.js';

export const buySchema = z.object({
  account_id: z.number().int().positive(),
  ticker: z.string().min(1).max(20),
  quantity: positiveAmountSchema,
  price_per_share: positiveAmountSchema,
  fees: feesSchema,
  date: dateSchema,
  description: descriptionSchema.optional(),
});

export const sellSchema = buySchema;

export const stockTransferSchema = z.object({
  to_account_id: z.number().int().positive(),
  ticker: z.string().min(1).max(20),
  quantity: positiveAmountSchema,
  date: dateSchema,
});

export const editOperationSchema = z.object({
  quantity: positiveAmountSchema,
  price_per_share: positiveAmountSchema,
  fees: feesSchema,
  date: dateSchema,
  description: descriptionSchema.optional(),
});

export const renameTickerSchema = z.object({
  new_ticker: z.string().min(1).max(20),
});

export function createStocksRouter(db: Database): Router {
  const repo = createStocksRepo(db);
  const router = Router();
  router.use(requireAuth);

  const checkAccount = makeCheckAccount((id, uid) => repo.accountBelongsToUser(id, uid));
  const handleStockAction = createAccountActionHandler(
    repo,
    (id) => repo.isInvestmentAccount(id),
    'stock.account_not_investment',
  );

  router.get('/:accountId/positions', checkAccount, (_req, res) => {
    res.json(repo.getPositions(res.locals.accountId));
  });

  router.get('/:accountId/operations', checkAccount, (_req, res) => {
    res.json(repo.getOperations(res.locals.accountId));
  });

  router.post('/:accountId/buy', (req, res) => {
    handleStockAction(req, res, buySchema, ({ userId, data }) => {
      const result = repo.buy(userId, data);
      repo.recalcPosition(data.account_id, data.ticker, userId);
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/sell', (req, res) => {
    handleStockAction(req, res, sellSchema, ({ userId, data }) => {
      const result = repo.sell(userId, data);
      repo.recalcPosition(data.account_id, data.ticker, userId);
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/transfer', (req, res) => {
    const fromAccountId = parseIdParam(req, 'accountId');
    const userId = currentUserId(res);

    if (!repo.accountBelongsToUser(fromAccountId, userId)) {
      throw new NotFoundError('stock.source_account_not_found');
    }
    if (!repo.isInvestmentAccount(fromAccountId)) {
      throw new BadRequestError('stock.source_not_investment');
    }

    const data = stockTransferSchema.parse(req.body);

    const { to_account_id } = data;
    if (!repo.accountBelongsToUser(to_account_id, userId)) {
      throw new NotFoundError('stock.dest_account_not_found');
    }
    if (!repo.isInvestmentAccount(to_account_id)) {
      throw new BadRequestError('stock.dest_not_investment');
    }
    if (to_account_id === fromAccountId) {
      throw new BadRequestError('stock.accounts_must_differ');
    }

    const result = repo.transfer(userId, { from_account_id: fromAccountId, ...data });
    repo.recalcPosition(fromAccountId, data.ticker, userId);
    repo.recalcPosition(data.to_account_id, data.ticker, userId);
    res.status(201).json(result);
  });

  router.put('/:accountId/operations/:operationId', checkAccount, (req, res) => {
    const accountId = res.locals.accountId;
    const userId = res.locals.userId;
    const operationId = parseIdParam(req, 'operationId');

    const op = repo.getOperationById(operationId);
    if (op?.account_id !== accountId) {
      throw new NotFoundError('stock.operation_not_found');
    }

    const data = editOperationSchema.parse(req.body);

    const operation = repo.updateOperation(operationId, userId, {
      account_id: accountId,
      ...data,
    });
    repo.recalcPosition(accountId, op.ticker, userId);
    res.json(operation);
  });

  router.get('/search', async (req, res) => {
    const q = (typeof req.query.q === 'string' ? req.query.q : '').trim();
    if (!q || q.length < 3) {
      res.json([]);
      return;
    }
    const results = await searchByQuery(q);
    res.json(results);
  });

  router.get('/tickers', (_req, res) => {
    res.json(repo.getCachedTickers(currentUserId(res)));
  });

  router.delete('/tickers/:ticker', (req, res) => {
    const { ticker } = req.params;
    if (!ticker) {
      throw new BadRequestError('stock.ticker_required');
    }
    if (repo.isTickerUsed(ticker)) {
      throw new ConflictError('stock.ticker_in_use', { ticker });
    }
    if (!repo.deleteCachedTicker(ticker)) {
      throw new NotFoundError('stock.ticker_not_cached', { ticker });
    }
    res.status(204).end();
  });

  router.put('/tickers/:ticker', (req, res) => {
    const { ticker } = req.params;
    if (!ticker) {
      throw new BadRequestError('stock.ticker_required');
    }
    const data = renameTickerSchema.parse(req.body);

    if (data.new_ticker === ticker) {
      throw new BadRequestError('stock.ticker_same');
    }
    if (repo.isCachedTicker(data.new_ticker)) {
      throw new ConflictError('stock.ticker_exists', { ticker: data.new_ticker });
    }
    if (!repo.isCachedTicker(ticker)) {
      throw new NotFoundError('stock.ticker_not_cached', { ticker });
    }
    if (repo.isTickerUsedByOthers(ticker, currentUserId(res))) {
      throw new ConflictError('stock.ticker_used_by_others', { ticker });
    }
    if (repo.hasPositionCollision(ticker, data.new_ticker)) {
      throw new ConflictError('stock.ticker_exists', { ticker: data.new_ticker });
    }
    repo.renameTicker(ticker, data.new_ticker);
    res.status(204).end();
  });

  router.get('/price/:ticker', async (req, res) => {
    const { ticker } = req.params;
    const price = await getOrRefreshPrice(repo, ticker);
    if (!price) {
      throw new NotFoundError('stock.price_not_found', { ticker });
    }
    res.json(price);
  });

  router.post('/prices/refresh', async (_req, res) => {
    await refreshUserPrices(db, currentUserId(res));
    res.status(204).end();
  });

  return router;
}
