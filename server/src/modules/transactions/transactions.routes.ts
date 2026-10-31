import { NO_CATEGORY } from '@cashctrl/types';
import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { MAX_PAGE_SIZE, REIMBURSEMENT_STATUSES, TRANSACTION_TYPES } from '../../constants.js';
import { NotFoundError } from '../../lib/errors.js';
import { parseIdParam } from '../../lib/routeHelpers.js';
import { dateSchema, descriptionSchema, positiveAmountSchema } from '../../lib/validators.js';
import { currentUserId, requireAuth } from '../../middleware.js';
import { createTransactionsRepo } from './transactions.repo.js';
import { transactionCreate, transactionDelete, transactionUpdate } from './transactions.service.js';

export const transactionSchema = z
  .object({
    account_id: z.number().int().positive(),
    type: z.enum(TRANSACTION_TYPES),
    amount: positiveAmountSchema,
    description: descriptionSchema,
    subcategory_id: z.number().int().positive().nullable().default(null),
    splits: z
      .array(
        z.object({
          subcategory_id: z.number().int().positive(),
          amount: positiveAmountSchema,
        }),
      )
      .optional(),
    date: dateSchema,
    payment_method_id: z.number().int().positive(),
    notes: z.string().max(1000).nullable().default(null),
    validated: z.boolean().default(false),
    reimbursement_status: z.enum(REIMBURSEMENT_STATUSES).nullable().default(null),
    scheduled_id: z.number().int().positive().nullable().optional().default(null),
  })
  .refine(
    (d) => {
      const hasSub = d.subcategory_id !== null;
      const hasSplits = (d.splits?.length ?? 0) > 0;
      return hasSub !== hasSplits;
    },
    { message: 'Exactly one of subcategory_id or splits must be provided' },
  );

export const querySchema = z.object({
  account_id: z.coerce.number().int().optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  category_id: z.union([z.literal(NO_CATEGORY), z.coerce.number().int()]).optional(),
  subcategory_id: z.coerce.number().int().optional(),
  description_contains: z.string().trim().optional(),
  date_from: dateSchema.optional(),
  date_to: dateSchema.optional(),
  amount_min: z.coerce.number().nonnegative().optional(),
  amount_max: z.coerce.number().positive().optional(),
  payment_method_id: z.coerce.number().int().positive().optional(),
  validated: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  scheduled_id: z.coerce.number().int().positive().optional(),
  exclude_transfers: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  exclude_linked_reimbursements: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});

export const validateSchema = z.object({ validated: z.boolean() });

export function createTransactionsRouter(db: Database): Router {
  const transactionsRepo = createTransactionsRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const userId = currentUserId(res);
    const query = querySchema.parse(req.query);
    res.json(transactionsRepo.getByUserId(userId, query));
  });

  router.post('/', (req, res) => {
    const data = transactionSchema.parse(req.body);
    res.status(201).json(transactionCreate(db, currentUserId(res), data));
  });

  router.put('/:id', (req, res) => {
    const id = parseIdParam(req);
    const data = transactionSchema.parse(req.body);
    res.json(transactionUpdate(db, currentUserId(res), id, data));
  });

  router.patch('/:id/validate', (req, res) => {
    const id = parseIdParam(req);
    const userId = currentUserId(res);
    const data = validateSchema.parse(req.body);

    if (!transactionsRepo.getById(id, userId)) {
      throw new NotFoundError('transaction.not_found');
    }

    transactionsRepo.setValidated(userId, id, data.validated);
    res.json(transactionsRepo.getWithDetails(id));
  });

  router.delete('/:id', (req, res) => {
    const id = parseIdParam(req);
    transactionDelete(db, currentUserId(res), id);
    res.json({ ok: true });
  });

  return router;
}
