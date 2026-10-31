import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import type { ErrorCode } from '../../lib/errorCodes.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { createAccountActionHandler } from '../../lib/handleAccountAction.js';
import { makeCheckAccount, parseIdParam } from '../../lib/routeHelpers.js';
import { dateSchema, feesSchema, nameSchema, positiveAmountSchema } from '../../lib/validators.js';
import { requireAuth } from '../../middleware.js';
import { createInsuranceRepo } from './insurance.repo.js';
import type { InsuranceSupport } from './insurance.types.js';

/**
 * Récupère un support et vérifie qu'il appartient bien au compte ciblé.
 * Lève 404 (`errorCode`) sinon.
 */
function requireSupport(
  repo: ReturnType<typeof createInsuranceRepo>,
  supportId: number,
  accountId: number,
  errorCode: ErrorCode = 'insurance.support_not_found',
): InsuranceSupport {
  const support = repo.getSupportById(supportId);
  if (support?.account_id !== accountId) {
    throw new NotFoundError(errorCode);
  }
  return support;
}

export const createSupportSchema = z.object({
  account_id: z.number().int().positive(),
  name: nameSchema,
  type: z.enum(['uc', 'euro']),
  ticker: z.string().min(1).max(20).nullable().optional(),
});

export const versementSchema = z.object({
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

export const rachatSchema = z.object({
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

export const arbitrageSchema = z.object({
  account_id: z.number().int().positive(),
  from_support_id: z.number().int().positive(),
  to_support_id: z.number().int().positive(),
  from_amount: positiveAmountSchema,
  fees: feesSchema,
  date: dateSchema,
});

export const interetsSchema = z.object({
  account_id: z.number().int().positive(),
  support_id: z.number().int().positive(),
  amount: positiveAmountSchema,
  date: dateSchema,
});

export const revaloriserSchema = z.object({
  account_id: z.number().int().positive(),
  support_id: z.number().int().positive(),
  amount: z.number(),
  date: dateSchema,
});

export const updateOperationSchema = z.object({
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
    const supportId = parseIdParam(req, 'supportId');

    requireSupport(repo, supportId, accountId);

    if (repo.hasOperations(supportId)) {
      throw new BadRequestError('insurance.support_has_operations');
    }

    repo.deleteSupport(supportId);
    res.status(204).end();
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
    const operationId = parseIdParam(req, 'operationId');
    const userId = res.locals.userId;

    const input = updateOperationSchema.parse(req.body);

    const operation = repo.updateOperation(operationId, userId, input);
    res.json(operation);
  });

  router.delete('/:accountId/operations/:operationId', checkAccount, (req, res) => {
    const operationId = parseIdParam(req, 'operationId');
    const userId = res.locals.userId;
    repo.deleteOperation(operationId, userId);
    res.status(204).end();
  });

  router.post('/:accountId/versement', (req, res) => {
    handleInsuranceAction(req, res, versementSchema, ({ userId, data }) => {
      requireSupport(repo, data.support_id, data.account_id);
      const result = repo.versement(userId, data);
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/rachat', (req, res) => {
    handleInsuranceAction(req, res, rachatSchema, ({ userId, data }) => {
      requireSupport(repo, data.support_id, data.account_id);
      const result = repo.rachat(userId, data);
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/arbitrage', (req, res) => {
    handleInsuranceAction(req, res, arbitrageSchema, ({ userId, data }) => {
      if (data.from_support_id === data.to_support_id) {
        throw new BadRequestError('insurance.supports_must_differ');
      }
      requireSupport(
        repo,
        data.from_support_id,
        data.account_id,
        'insurance.support_source_not_found',
      );
      requireSupport(repo, data.to_support_id, data.account_id, 'insurance.support_dest_not_found');
      const result = repo.arbitrage(userId, data);
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/interets', (req, res) => {
    handleInsuranceAction(req, res, interetsSchema, ({ userId, data }) => {
      const support = requireSupport(repo, data.support_id, data.account_id);
      if (support.type !== 'euro') {
        throw new BadRequestError('insurance.interets_euro_only');
      }
      const result = repo.interets(userId, data);
      res.status(201).json(result);
    });
  });

  router.post('/:accountId/revalorisation', (req, res) => {
    handleInsuranceAction(req, res, revaloriserSchema, ({ userId, data }) => {
      const support = requireSupport(repo, data.support_id, data.account_id);
      if (support.type !== 'uc') {
        throw new BadRequestError('insurance.revalorisation_uc_only');
      }
      const operation = repo.revaloriser(userId, data);
      res.status(201).json({ operation });
    });
  });

  return router;
}
