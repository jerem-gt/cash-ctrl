import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, sessionUserId } from '../../middleware.js';
import { handleStockAction } from './stocks.handlers';
import { createStocksRepo } from './stocks.repo.js';
import { getOrRefreshPrice, refreshAllPrices } from './stocks.service.js';

const buySchema = z.object({
  account_id: z.number().int().positive(),
  ticker: z.string().min(1).max(20),
  quantity: z.number().positive(),
  price_per_share: z.number().positive(),
  fees: z.number().min(0).default(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(200).optional(),
});

const sellSchema = buySchema;

const editOperationSchema = z.object({
  quantity: z.number().positive(),
  price_per_share: z.number().positive(),
  fees: z.number().min(0).default(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(200).optional(),
});

export function createStocksRouter(db: Database): Router {
  const repo = createStocksRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/:accountId/positions', (req, res) => {
    const accountId = Number.parseInt(req.params.accountId);
    const userId = sessionUserId(req);
    if (!repo.accountBelongsToUser(accountId, userId)) {
      res.status(403).json({ error: 'Compte introuvable' });
      return;
    }
    res.json(repo.getPositions(accountId));
  });

  router.get('/:accountId/operations', (req, res) => {
    const accountId = Number.parseInt(req.params.accountId);
    const userId = sessionUserId(req);
    if (!repo.accountBelongsToUser(accountId, userId)) {
      res.status(403).json({ error: 'Compte introuvable' });
      return;
    }
    res.json(repo.getOperations(accountId));
  });

  router.post('/:accountId/buy', (req, res) => {
    handleStockAction(req, res, repo, buySchema, ({ userId, data }) => {
      const result = repo.buy(userId, data);
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/sell', (req, res) => {
    handleStockAction(req, res, repo, sellSchema, ({ userId, data }) => {
      const result = repo.sell(userId, data);
      res.status(201).json(result);
    });
  });

  router.put('/:accountId/operations/:operationId', (req, res) => {
    const accountId = Number.parseInt(req.params.accountId);
    const operationId = Number.parseInt(req.params.operationId);
    const userId = sessionUserId(req);

    if (!repo.accountBelongsToUser(accountId, userId)) {
      res.status(403).json({ error: 'Compte introuvable' });
      return;
    }

    const op = repo.getOperationById(operationId);
    if (op?.account_id !== accountId) {
      res.status(404).json({ error: 'Opération introuvable' });
      return;
    }

    const parsed = editOperationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    try {
      const operation = repo.updateOperation(operationId, {
        account_id: accountId,
        ...parsed.data,
      });
      res.json(operation);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.get('/price/:ticker', async (req, res) => {
    const { ticker } = req.params;
    const price = await getOrRefreshPrice(db, ticker);
    if (!price) {
      res.status(404).json({ error: `Cotation introuvable pour ${ticker}` });
      return;
    }
    res.json(price);
  });

  router.post('/prices/refresh', async (_req, res) => {
    await refreshAllPrices(db);
    res.json({ ok: true });
  });

  return router;
}
