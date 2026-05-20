import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { makeCheckAccount } from '../../lib/routeHelpers';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { handleStockAction } from './stocks.handlers';
import { createStocksRepo } from './stocks.repo.js';
import {
  getOrRefreshPrice,
  recalcPosition,
  refreshAllPrices,
  searchByQuery,
} from './stocks.service.js';

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

const transferSchema = z.object({
  to_account_id: z.number().int().positive(),
  ticker: z.string().min(1).max(20),
  quantity: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

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
      recalcPosition(db, data.account_id, data.ticker, userId);
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/sell', (req, res) => {
    handleStockAction(req, res, repo, sellSchema, ({ userId, data }) => {
      const result = repo.sell(userId, data);
      recalcPosition(db, data.account_id, data.ticker, userId);
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/transfer', (req, res) => {
    const fromAccountId = Number.parseInt(req.params.accountId, 10);
    const userId = sessionUserId(req);

    if (!repo.accountBelongsToUser(fromAccountId, userId)) {
      res.status(403).json({ error: 'Compte source introuvable' });
      return;
    }
    if (!repo.isInvestmentAccount(fromAccountId)) {
      res.status(400).json({ error: "Le compte source n'est pas un compte d'investissement" });
      return;
    }

    const parsed = transferSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    const { to_account_id } = parsed.data;
    if (!repo.accountBelongsToUser(to_account_id, userId)) {
      res.status(403).json({ error: 'Compte destination introuvable' });
      return;
    }
    if (!repo.isInvestmentAccount(to_account_id)) {
      res.status(400).json({ error: "Le compte destination n'est pas un compte d'investissement" });
      return;
    }
    if (to_account_id === fromAccountId) {
      res.status(400).json({ error: 'Les comptes source et destination doivent être différents' });
      return;
    }

    try {
      const result = repo.transfer(userId, { from_account_id: fromAccountId, ...parsed.data });
      recalcPosition(db, fromAccountId, parsed.data.ticker, userId);
      recalcPosition(db, parsed.data.to_account_id, parsed.data.ticker, userId);
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.put('/:accountId/operations/:operationId', checkAccount, (req, res) => {
    const accountId = res.locals.accountId as number;
    const userId = res.locals.userId as number;
    const operationId = Number.parseInt(req.params.operationId as string, 10);

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
      const operation = repo.updateOperation(operationId, userId, {
        account_id: accountId,
        ...parsed.data,
      });
      recalcPosition(db, accountId, op.ticker, userId);
      res.json(operation);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.get('/search', async (req, res) => {
    const q = String(req.query.q ?? '').trim();
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
