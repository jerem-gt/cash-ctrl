import type { Database } from 'better-sqlite3';
import { type Response, Router } from 'express';
import { z } from 'zod';

import type { ErrorCode } from '../../lib/errorCodes';
import { createAccountActionHandler } from '../../lib/handleAccountAction';
import {
  handleHttpErrors,
  makeCheckAccount,
  parseNumberParam,
  sendError,
  zodToApiError,
} from '../../lib/routeHelpers';
import { dateSchema, feesSchema, nameSchema, positiveAmountSchema } from '../../lib/validators';
import { requireAuth } from '../../middleware.js';
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
  name: nameSchema,
  type: z.enum(['uc', 'euro']),
  ticker: z.string().min(1).max(20).nullable().optional(),
});

const versementSchema = z.object({
  account_id: z.number().int().positive(),
  support_id: z.number().int().positive(),
  amount: positiveAmountSchema,
  fees: feesSchema,
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
  amount: positiveAmountSchema,
  fees: feesSchema,
  social_fees: feesSchema,
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
  from_amount: positiveAmountSchema,
  fees: feesSchema,
  date: dateSchema,
});

const interetsSchema = z.object({
  account_id: z.number().int().positive(),
  support_id: z.number().int().positive(),
  amount: positiveAmountSchema,
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
  fees: feesSchema,
  social_fees: feesSchema,
  date: dateSchema,
});

export function createInsuranceRouter(db: Database): Router {
  const repo = createInsuranceRepo(db);
  const router = Router();
  router.use(requireAuth);

  const handleInsuranceAction = createAccountActionHandler(
    repo,
    (id) => repo.isInsuranceAccount(id),
    'insurance.account_not_insurance',
  );

  const checkAccount = makeCheckAccount((id, uid) => repo.accountBelongsToUser(id, uid));

  // ─── Supports ──────────────────────────────────────────────────────────────

  router.get('/:accountId/supports', checkAccount, (_req, res) => {
    res.json(repo.getSupports(res.locals.accountId));
  });

  router.post('/:accountId/supports', (req, res) => {
    handleInsuranceAction(req, res, createSupportSchema, ({ userId, data }) => {
      const support = repo.createSupport(userId, data);
      res.status(201).json(support);
    });
  });

  router.delete('/:accountId/supports/:supportId', checkAccount, (req, res) => {
    const accountId = res.locals.accountId;
    const supportId = parseNumberParam(req, res, 'supportId');
    if (supportId === null) return;

    if (!requireSupport(res, repo, supportId, accountId)) return;

    if (repo.hasOperations(supportId)) {
      sendError(res, 400, 'insurance.support_has_operations');
      return;
    }

    repo.deleteSupport(supportId);
    res.json({ ok: true });
  });

  // ─── Positions ─────────────────────────────────────────────────────────────

  router.get('/:accountId/positions', checkAccount, (_req, res) => {
    res.json(repo.getPositions(res.locals.accountId));
  });

  // ─── Opérations ────────────────────────────────────────────────────────────

  router.get('/:accountId/operations', checkAccount, (_req, res) => {
    res.json(repo.getOperations(res.locals.accountId));
  });

  router.put('/:accountId/operations/:operationId', checkAccount, (req, res) => {
    const operationId = parseNumberParam(req, res, 'operationId');
    if (operationId === null) return;
    const userId = res.locals.userId;

    const parsed = updateOperationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: zodToApiError(parsed.error) });
      return;
    }

    handleHttpErrors(res, () => {
      const operation = repo.updateOperation(operationId, userId, parsed.data);
      res.json(operation);
    });
  });

  router.delete('/:accountId/operations/:operationId', checkAccount, (req, res) => {
    const operationId = parseNumberParam(req, res, 'operationId');
    if (operationId === null) return;
    const userId = res.locals.userId;
    handleHttpErrors(res, () => {
      repo.deleteOperation(operationId, userId);
      res.json({ ok: true });
    });
  });

  router.post('/:accountId/versement', (req, res) => {
    handleInsuranceAction(req, res, versementSchema, ({ userId, data }) => {
      if (!requireSupport(res, repo, data.support_id, data.account_id)) return;
      const result = repo.versement(userId, data);
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/rachat', (req, res) => {
    handleInsuranceAction(req, res, rachatSchema, ({ userId, data }) => {
      if (!requireSupport(res, repo, data.support_id, data.account_id)) return;
      const result = repo.rachat(userId, data);
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/arbitrage', (req, res) => {
    handleInsuranceAction(req, res, arbitrageSchema, ({ userId, data }) => {
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
    handleInsuranceAction(req, res, interetsSchema, ({ userId, data }) => {
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
    handleInsuranceAction(req, res, revaloriserSchema, ({ userId, data }) => {
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
