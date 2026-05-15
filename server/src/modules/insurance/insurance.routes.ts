import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, sessionUserId } from '../../middleware.js';
import { handleInsuranceAction } from './insurance.handlers.js';
import { createInsuranceRepo } from './insurance.repo.js';

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
  fees: z.number().min(0).default(0),
  date: z.string().regex(DATE_REGEX),
  source_account_id: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});

const rachatSchema = z.object({
  account_id: z.number().int().positive(),
  support_id: z.number().int().positive(),
  amount: z.number().positive(),
  fees: z.number().min(0).default(0),
  social_fees: z.number().min(0).default(0),
  date: z.string().regex(DATE_REGEX),
  dest_account_id: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});

const arbitrageSchema = z.object({
  account_id: z.number().int().positive(),
  from_support_id: z.number().int().positive(),
  to_support_id: z.number().int().positive(),
  from_amount: z.number().positive(),
  fees: z.number().min(0).default(0),
  date: z.string().regex(DATE_REGEX),
});

const interetsSchema = z.object({
  account_id: z.number().int().positive(),
  support_id: z.number().int().positive(),
  amount: z.number().positive(),
  date: z.string().regex(DATE_REGEX),
});

const revaloriserSchema = z.object({
  account_id: z.number().int().positive(),
  support_id: z.number().int().positive(),
  amount: z.number(),
  date: z.string().regex(DATE_REGEX),
});

const updateOperationSchema = z.object({
  amount: z.number(),
  fees: z.number().min(0).default(0),
  social_fees: z.number().min(0).default(0),
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

    const balance = repo.getBalanceCents(accountId, supportId);
    if (balance !== 0) {
      res.status(400).json({ error: 'Impossible de supprimer un support avec un solde non nul' });
      return;
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

  router.put('/:accountId/operations/:operationId', (req, res) => {
    const accountId = Number.parseInt(req.params.accountId);
    const operationId = Number.parseInt(req.params.operationId);
    const userId = sessionUserId(req);

    if (!repo.accountBelongsToUser(accountId, userId)) {
      res.status(403).json({ error: 'Compte introuvable' });
      return;
    }

    const parsed = updateOperationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    try {
      const operation = repo.updateOperation(operationId, userId, parsed.data);
      res.json(operation);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      const status = msg.includes('introuvable') ? 404 : 400;
      res.status(status).json({ error: msg });
    }
  });

  router.delete('/:accountId/operations/:operationId', (req, res) => {
    const accountId = Number.parseInt(req.params.accountId);
    const operationId = Number.parseInt(req.params.operationId);
    const userId = sessionUserId(req);
    if (!repo.accountBelongsToUser(accountId, userId)) {
      res.status(403).json({ error: 'Compte introuvable' });
      return;
    }
    try {
      repo.deleteOperation(operationId, userId);
      res.json({ ok: true });
    } catch {
      res.status(404).json({ error: 'Opération introuvable' });
    }
  });

  router.post('/:accountId/versement', (req, res) => {
    handleInsuranceAction(req, res, repo, versementSchema, ({ userId, data }) => {
      const support = repo.getSupportById(data.support_id);
      if (support?.account_id !== data.account_id) {
        res.status(404).json({ error: 'Support introuvable' });
        return;
      }
      const result = repo.versement(userId, data);
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

  router.post('/:accountId/revalorisation', (req, res) => {
    handleInsuranceAction(req, res, repo, revaloriserSchema, ({ userId, data }) => {
      const support = repo.getSupportById(data.support_id);
      if (support?.account_id !== data.account_id) {
        res.status(404).json({ error: 'Support introuvable' });
        return;
      }
      if (support.type !== 'uc') {
        res.status(400).json({ error: 'La revalorisation ne concerne que les UC' });
        return;
      }
      const operation = repo.revaloriser(userId, data);
      res.status(201).json({ operation });
    });
  });

  return router;
}
