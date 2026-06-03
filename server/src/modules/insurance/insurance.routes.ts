import type { Database } from 'better-sqlite3';
import { type Response, Router } from 'express';
import { z } from 'zod';

import type { ErrorCode } from '../../lib/errorCodes';
import { HttpError } from '../../lib/errors';
import {
  makeCheckAccount,
  parseNumberParam,
  sendError,
  zodToApiError,
} from '../../lib/routeHelpers';
import { dateSchema } from '../../lib/validators';
import { requireAuth } from '../../middleware.js';
import { handleInsuranceAction } from './insurance.handlers.js';
import { createInsuranceRepo } from './insurance.repo.js';
import type { InsuranceSupport } from './insurance.types';

/**
 * Récupère un support et vérifie qu'il appartient bien au compte ciblé.
 * Répond 404 et renvoie null sinon.
 */
function requireSupport(
  res: Response,
  repo: ReturnType<typeof createInsuranceRepo>,
  supportId: number,
  accountId: number,
  errorCode: ErrorCode = 'insurance.support_not_found',
): InsuranceSupport | null {
  const support = repo.getSupportById(supportId);
  if (support?.account_id !== accountId) {
    sendError(res, 404, errorCode);
    return null;
  }
  return support;
}

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
  date: dateSchema,
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
  date: dateSchema,
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
  date: dateSchema,
});

const interetsSchema = z.object({
  account_id: z.number().int().positive(),
  support_id: z.number().int().positive(),
  amount: z.number().positive(),
  date: dateSchema,
});

const revaloriserSchema = z.object({
  account_id: z.number().int().positive(),
  support_id: z.number().int().positive(),
  amount: z.number(),
  date: dateSchema,
});

const updateOperationSchema = z.object({
  amount: z.number(),
  fees: z.number().min(0).default(0),
  social_fees: z.number().min(0).default(0),
  date: dateSchema,
});

export function createInsuranceRouter(db: Database): Router {
  const repo = createInsuranceRepo(db);
  const router = Router();
  router.use(requireAuth);

  const checkAccount = makeCheckAccount((id, uid) => repo.accountBelongsToUser(id, uid));

  // ─── Supports ──────────────────────────────────────────────────────────────

  router.get('/:accountId/supports', checkAccount, (_req, res) => {
    res.json(repo.getSupports(res.locals.accountId as number));
  });

  router.post('/:accountId/supports', (req, res) => {
    handleInsuranceAction(req, res, repo, createSupportSchema, ({ userId, data }) => {
      const support = repo.createSupport(userId, data);
      res.status(201).json(support);
    });
  });

  router.delete('/:accountId/supports/:supportId', checkAccount, (req, res) => {
    const accountId = res.locals.accountId as number;
    const supportId = parseNumberParam(req, res, 'supportId');
    if (supportId === null) return;

    const support = repo.getSupportById(supportId);
    if (support?.account_id !== accountId) {
      sendError(res, 404, 'insurance.support_not_found');
      return;
    }

    if (repo.hasOperations(supportId)) {
      sendError(res, 400, 'insurance.support_has_operations');
      return;
    }

    repo.deleteSupport(supportId);
    res.json({ ok: true });
  });

  // ─── Positions ─────────────────────────────────────────────────────────────

  router.get('/:accountId/positions', checkAccount, (_req, res) => {
    res.json(repo.getPositions(res.locals.accountId as number));
  });

  // ─── Opérations ────────────────────────────────────────────────────────────

  router.get('/:accountId/operations', checkAccount, (_req, res) => {
    res.json(repo.getOperations(res.locals.accountId as number));
  });

  router.put('/:accountId/operations/:operationId', checkAccount, (req, res) => {
    const operationId = parseNumberParam(req, res, 'operationId');
    if (operationId === null) return;
    const userId = res.locals.userId as number;

    const parsed = updateOperationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: zodToApiError(parsed.error) });
      return;
    }

    try {
      const operation = repo.updateOperation(operationId, userId, parsed.data);
      res.json(operation);
    } catch (err) {
      if (err instanceof HttpError) {
        sendError(res, err.status, err.code, err.params);
      } else {
        sendError(res, 400, 'common.invalid_request');
      }
    }
  });

  router.delete('/:accountId/operations/:operationId', checkAccount, (req, res) => {
    const operationId = parseNumberParam(req, res, 'operationId');
    if (operationId === null) return;
    const userId = res.locals.userId as number;
    try {
      repo.deleteOperation(operationId, userId);
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof HttpError) {
        sendError(res, err.status, err.code, err.params);
      } else {
        sendError(res, 404, 'insurance.operation_not_found');
      }
    }
  });

  router.post('/:accountId/versement', (req, res) => {
    handleInsuranceAction(req, res, repo, versementSchema, ({ userId, data }) => {
      if (!requireSupport(res, repo, data.support_id, data.account_id)) return;
      const result = repo.versement(userId, data);
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/rachat', (req, res) => {
    handleInsuranceAction(req, res, repo, rachatSchema, ({ userId, data }) => {
      if (!requireSupport(res, repo, data.support_id, data.account_id)) return;
      const result = repo.rachat(userId, data);
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/arbitrage', (req, res) => {
    handleInsuranceAction(req, res, repo, arbitrageSchema, ({ userId, data }) => {
      if (data.from_support_id === data.to_support_id) {
        sendError(res, 400, 'insurance.supports_must_differ');
        return;
      }
      if (
        !requireSupport(
          res,
          repo,
          data.from_support_id,
          data.account_id,
          'insurance.support_source_not_found',
        )
      )
        return;
      if (
        !requireSupport(
          res,
          repo,
          data.to_support_id,
          data.account_id,
          'insurance.support_dest_not_found',
        )
      )
        return;
      const result = repo.arbitrage(userId, data);
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/interets', (req, res) => {
    handleInsuranceAction(req, res, repo, interetsSchema, ({ userId, data }) => {
      const support = requireSupport(res, repo, data.support_id, data.account_id);
      if (!support) return;
      if (support.type !== 'euro') {
        sendError(res, 400, 'insurance.interets_euro_only');
        return;
      }
      const result = repo.interets(userId, data);
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/revalorisation', (req, res) => {
    handleInsuranceAction(req, res, repo, revaloriserSchema, ({ userId, data }) => {
      const support = requireSupport(res, repo, data.support_id, data.account_id);
      if (!support) return;
      if (support.type !== 'uc') {
        sendError(res, 400, 'insurance.revalorisation_uc_only');
        return;
      }
      const operation = repo.revaloriser(userId, data);
      res.status(201).json({ operation });
    });
  });

  return router;
}
