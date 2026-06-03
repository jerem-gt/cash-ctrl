import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { HttpError } from '../../lib/errors';
import { makeCheckAccount, parseBody, parseNumberParam, sendError } from '../../lib/routeHelpers';
import { dateSchema } from '../../lib/validators';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { handleStockAction } from './stocks.handlers';
import { createStocksRepo } from './stocks.repo.js';
import { getOrRefreshPrice, refreshUserPrices, searchByQuery } from './stocks.service.js';

const buySchema = z.object({
  account_id: z.number().int().positive(),
  ticker: z.string().min(1).max(20),
  quantity: z.number().positive(),
  price_per_share: z.number().positive(),
  fees: z.number().min(0).default(0),
  date: dateSchema,
  description: z.string().min(1).max(200).optional(),
});

const sellSchema = buySchema;

const transferSchema = z.object({
  to_account_id: z.number().int().positive(),
  ticker: z.string().min(1).max(20),
  quantity: z.number().positive(),
  date: dateSchema,
});

const editOperationSchema = z.object({
  quantity: z.number().positive(),
  price_per_share: z.number().positive(),
  fees: z.number().min(0).default(0),
  date: dateSchema,
  description: z.string().min(1).max(200).optional(),
});

export function createStocksRouter(db: Database): Router {
  const repo = createStocksRepo(db);
  const router = Router();
  router.use(requireAuth);

  const checkAccount = makeCheckAccount((id, uid) => repo.accountBelongsToUser(id, uid));

  router.get('/:accountId/positions', checkAccount, (_req, res) => {
    res.json(repo.getPositions(res.locals.accountId as number));
  });

  router.get('/:accountId/operations', checkAccount, (_req, res) => {
    res.json(repo.getOperations(res.locals.accountId as number));
  });

  router.post('/:accountId/buy', (req, res) => {
    handleStockAction(req, res, repo, buySchema, ({ userId, data }) => {
      const result = repo.buy(userId, data);
      repo.recalcPosition(data.account_id, data.ticker, userId);
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/sell', (req, res) => {
    handleStockAction(req, res, repo, sellSchema, ({ userId, data }) => {
      const result = repo.sell(userId, data);
      repo.recalcPosition(data.account_id, data.ticker, userId);
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/transfer', (req, res) => {
    const fromAccountId = parseNumberParam(req, res, 'accountId');
    if (fromAccountId === null) return;
    const userId = sessionUserId(req);

    if (!repo.accountBelongsToUser(fromAccountId, userId)) {
      sendError(res, 403, 'stock.source_account_not_found');
      return;
    }
    if (!repo.isInvestmentAccount(fromAccountId)) {
      sendError(res, 400, 'stock.source_not_investment');
      return;
    }

    const data = parseBody(res, transferSchema, req.body);
    if (!data) return;

    const { to_account_id } = data;
    if (!repo.accountBelongsToUser(to_account_id, userId)) {
      sendError(res, 403, 'stock.dest_account_not_found');
      return;
    }
    if (!repo.isInvestmentAccount(to_account_id)) {
      sendError(res, 400, 'stock.dest_not_investment');
      return;
    }
    if (to_account_id === fromAccountId) {
      sendError(res, 400, 'stock.accounts_must_differ');
      return;
    }

    try {
      const result = repo.transfer(userId, { from_account_id: fromAccountId, ...data });
      repo.recalcPosition(fromAccountId, data.ticker, userId);
      repo.recalcPosition(data.to_account_id, data.ticker, userId);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof HttpError) {
        sendError(res, err.status, err.code, err.params);
      } else {
        sendError(res, 400, 'common.invalid_request');
      }
    }
  });

  router.put('/:accountId/operations/:operationId', checkAccount, (req, res) => {
    const accountId = res.locals.accountId as number;
    const userId = res.locals.userId as number;
    const operationId = parseNumberParam(req, res, 'operationId');
    if (operationId === null) return;

    const op = repo.getOperationById(operationId);
    if (op?.account_id !== accountId) {
      sendError(res, 404, 'stock.operation_not_found');
      return;
    }

    const data = parseBody(res, editOperationSchema, req.body);
    if (!data) return;

    try {
      const operation = repo.updateOperation(operationId, userId, {
        account_id: accountId,
        ...data,
      });
      repo.recalcPosition(accountId, op.ticker, userId);
      res.json(operation);
    } catch (err) {
      if (err instanceof HttpError) {
        sendError(res, err.status, err.code, err.params);
      } else {
        sendError(res, 400, 'common.invalid_request');
      }
    }
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

  router.get('/price/:ticker', async (req, res) => {
    const { ticker } = req.params;
    const price = await getOrRefreshPrice(repo, ticker);
    if (!price) {
      sendError(res, 404, 'stock.price_not_found', { ticker });
      return;
    }
    res.json(price);
  });

  router.post('/prices/refresh', async (req, res) => {
    await refreshUserPrices(db, sessionUserId(req));
    res.json({ ok: true });
  });

  return router;
}
