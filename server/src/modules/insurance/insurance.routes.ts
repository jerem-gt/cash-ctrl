import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, sessionUserId } from '../../middleware.js';
import { getOrRefreshPrice } from '../stocks/stocks.service.js';
import { handleInsuranceAction } from './insurance.handlers.js';
import { createInsuranceRepo } from './insurance.repo.js';
import { recalcUcPosition, refreshInsurancePrices } from './insurance.service.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const createSupportSchema = z.object({
  account_id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  type: z.enum(['uc', 'euro']),
  ticker: z.string().min(1).max(20).nullable().optional(),
});

const versementSchema = z.object({
  account_id: z.number().int().positive(),
  support_id: z.number().int().positive(),
  amount: z.number().positive(),
  quantity: z
    .number()
    .positive()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  price_per_unit: z
    .number()
    .positive()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  fees: z.number().min(0).default(0),
  date: z.string().regex(DATE_REGEX),
});

const rachatSchema = versementSchema;

const arbitrageSchema = z.object({
  account_id: z.number().int().positive(),
  from_support_id: z.number().int().positive(),
  to_support_id: z.number().int().positive(),
  from_amount: z.number().positive(),
  from_quantity: z
    .number()
    .positive()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  from_price_per_unit: z
    .number()
    .positive()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  to_quantity: z
    .number()
    .positive()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  to_price_per_unit: z
    .number()
    .positive()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  fees: z.number().min(0).default(0),
  date: z.string().regex(DATE_REGEX),
});

const interetsSchema = z.object({
  account_id: z.number().int().positive(),
  support_id: z.number().int().positive(),
  amount: z.number().positive(),
  date: z.string().regex(DATE_REGEX),
});

export function createInsuranceRouter(db: Database): Router {
  const repo = createInsuranceRepo(db);
  const router = Router();
  router.use(requireAuth);

  // ─── Supports ──────────────────────────────────────────────────────────────

  router.get('/:accountId/supports', (req, res) => {
    const accountId = Number.parseInt(req.params.accountId);
    const userId = sessionUserId(req);
    if (!repo.accountBelongsToUser(accountId, userId)) {
      res.status(403).json({ error: 'Compte introuvable' });
      return;
    }
    res.json(repo.getSupports(accountId));
  });

  router.post('/:accountId/supports', (req, res) => {
    handleInsuranceAction(req, res, repo, createSupportSchema, ({ userId, data }) => {
      const support = repo.createSupport(userId, data);
      res.status(201).json(support);
    });
  });

  router.delete('/:accountId/supports/:supportId', (req, res) => {
    const accountId = Number.parseInt(req.params.accountId);
    const supportId = Number.parseInt(req.params.supportId);
    const userId = sessionUserId(req);

    if (!repo.accountBelongsToUser(accountId, userId)) {
      res.status(403).json({ error: 'Compte introuvable' });
      return;
    }

    const support = repo.getSupportById(supportId);
    if (support?.account_id !== accountId) {
      res.status(404).json({ error: 'Support introuvable' });
      return;
    }

    if (support.type === 'uc') {
      const qty = repo.getUcPositionQty(accountId, supportId);
      if (qty > 0) {
        res.status(400).json({ error: 'Impossible de supprimer un support avec des parts' });
        return;
      }
    } else {
      const balance = repo.getEuroBalanceCents(accountId, supportId);
      if (balance > 0) {
        res.status(400).json({ error: 'Impossible de supprimer un support avec un solde non nul' });
        return;
      }
    }

    repo.deleteSupport(supportId);
    res.json({ ok: true });
  });

  // ─── Positions ─────────────────────────────────────────────────────────────

  router.get('/:accountId/positions', (req, res) => {
    const accountId = Number.parseInt(req.params.accountId);
    const userId = sessionUserId(req);
    if (!repo.accountBelongsToUser(accountId, userId)) {
      res.status(403).json({ error: 'Compte introuvable' });
      return;
    }
    res.json(repo.getPositions(accountId));
  });

  // ─── Opérations ────────────────────────────────────────────────────────────

  router.get('/:accountId/operations', (req, res) => {
    const accountId = Number.parseInt(req.params.accountId);
    const userId = sessionUserId(req);
    if (!repo.accountBelongsToUser(accountId, userId)) {
      res.status(403).json({ error: 'Compte introuvable' });
      return;
    }
    res.json(repo.getOperations(accountId));
  });

  router.post('/:accountId/versement', (req, res) => {
    handleInsuranceAction(req, res, repo, versementSchema, ({ userId, data }) => {
      const support = repo.getSupportById(data.support_id);
      if (support?.account_id !== data.account_id) {
        res.status(404).json({ error: 'Support introuvable' });
        return;
      }
      const result = repo.versement(userId, data);
      if (support.type === 'uc') {
        recalcUcPosition(db, data.account_id, data.support_id, userId);
      }
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/rachat', (req, res) => {
    handleInsuranceAction(req, res, repo, rachatSchema, ({ userId, data }) => {
      const support = repo.getSupportById(data.support_id);
      if (support?.account_id !== data.account_id) {
        res.status(404).json({ error: 'Support introuvable' });
        return;
      }
      const result = repo.rachat(userId, data);
      if (support.type === 'uc') {
        recalcUcPosition(db, data.account_id, data.support_id, userId);
      }
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/arbitrage', (req, res) => {
    handleInsuranceAction(req, res, repo, arbitrageSchema, ({ userId, data }) => {
      if (data.from_support_id === data.to_support_id) {
        res
          .status(400)
          .json({ error: 'Les supports source et destination doivent être différents' });
        return;
      }
      const fromSupport = repo.getSupportById(data.from_support_id);
      const toSupport = repo.getSupportById(data.to_support_id);
      if (fromSupport?.account_id !== data.account_id) {
        res.status(404).json({ error: 'Support source introuvable' });
        return;
      }
      if (toSupport?.account_id !== data.account_id) {
        res.status(404).json({ error: 'Support destination introuvable' });
        return;
      }
      const result = repo.arbitrage(userId, data);
      if (fromSupport.type === 'uc') {
        recalcUcPosition(db, data.account_id, data.from_support_id, userId);
      }
      if (toSupport.type === 'uc') {
        recalcUcPosition(db, data.account_id, data.to_support_id, userId);
      }
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/interets', (req, res) => {
    handleInsuranceAction(req, res, repo, interetsSchema, ({ userId, data }) => {
      const support = repo.getSupportById(data.support_id);
      if (support?.account_id !== data.account_id) {
        res.status(404).json({ error: 'Support introuvable' });
        return;
      }
      if (support.type !== 'euro') {
        res.status(400).json({ error: 'Les intérêts ne concernent que les fonds euro' });
        return;
      }
      const result = repo.interets(userId, data);
      res.status(201).json(result);
    });
  });

  // ─── Prix ──────────────────────────────────────────────────────────────────

  router.get('/price/:ticker', async (req, res) => {
    const { ticker } = req.params;
    const price = await getOrRefreshPrice(repo, ticker);
    if (!price) {
      res.status(404).json({ error: `VL introuvable pour ${ticker}` });
      return;
    }
    res.json(price);
  });

  router.post('/:accountId/prices/refresh', async (req, res) => {
    const accountId = Number.parseInt(req.params.accountId);
    const userId = sessionUserId(req);
    if (!repo.accountBelongsToUser(accountId, userId)) {
      res.status(403).json({ error: 'Compte introuvable' });
      return;
    }
    await refreshInsurancePrices(db, accountId);
    res.json({ ok: true });
  });

  return router;
}
