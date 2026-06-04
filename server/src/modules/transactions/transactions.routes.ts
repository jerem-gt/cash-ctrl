import type { Database } from 'better-sqlite3';
import { type Response, Router } from 'express';
import { z } from 'zod';

import {
  type EnvelopeType,
  MAX_PAGE_SIZE,
  REIMBURSEMENT_STATUSES,
  TRANSACTION_TYPES,
} from '../../constants';
import { parseBody, parseNumberParam, sendError, zodToApiError } from '../../lib/routeHelpers';
import { dateSchema } from '../../lib/validators';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createAccountsRepo } from '../accounts/accounts.repo';
import { createScheduledRepo } from '../scheduled/scheduled.repo';
import { createStocksRepo } from '../stocks/stocks.repo';
import { createTransactionsRepo } from './transactions.repo';

const transactionSchema = z
  .object({
    account_id: z.number().int().positive(),
    type: z.enum(TRANSACTION_TYPES),
    amount: z.number().positive(),
    description: z.string().min(1).max(200),
    subcategory_id: z.number().int().positive().nullable().default(null),
    splits: z
      .array(
        z.object({
          subcategory_id: z.number().int().positive(),
          amount: z.number().positive(),
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

const querySchema = z.object({
  account_id: z.coerce.number().int().optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  category_id: z.coerce.number().int().optional(),
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
  exclude_linked_reimbursements: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});

const validateSchema = z.object({ validated: z.boolean() });

const NO_DIRECT_WRITE_ENVELOPES: ReadonlyArray<EnvelopeType> = ['life_insurance', 'per'];

/**
 * Récupère le compte cible d'une écriture et vérifie qu'il appartient à
 * l'utilisateur et qu'il n'est pas une enveloppe AV/PER (écriture interdite en
 * direct). Répond directement (403/400) et renvoie null si la condition échoue.
 */
function resolveWritableAccount(
  res: Response,
  accountsRepo: ReturnType<typeof createAccountsRepo>,
  accountId: number,
  userId: number,
) {
  const account = accountsRepo.getById(accountId, userId);
  if (!account) {
    sendError(res, 403, 'account.not_found_or_not_owned');
    return null;
  }
  if (NO_DIRECT_WRITE_ENVELOPES.includes(account.envelope_type as EnvelopeType)) {
    sendError(res, 400, 'transaction.no_direct_on_av_per');
    return null;
  }
  return account;
}

export function createTransactionsRouter(db: Database): Router {
  const transactionsRepo = createTransactionsRepo(db);
  const accountsRepo = createAccountsRepo(db);
  const scheduledRepo = createScheduledRepo(db);
  const stocksRepo = createStocksRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const userId = sessionUserId(req);

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: zodToApiError(parsed.error) });
      return;
    }

    res.json(transactionsRepo.getByUserId(userId, parsed.data));
  });

  router.post('/', (req, res) => {
    const data = parseBody(res, transactionSchema, req.body);
    if (!data) return;
    const userId = sessionUserId(req);

    if (!resolveWritableAccount(res, accountsRepo, data.account_id, userId)) return;

    const result = transactionsRepo.create(userId, {
      ...data,
      description: data.description.trim(),
    });
    res.status(201).json(transactionsRepo.getWithDetails(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const userId = sessionUserId(req);

    const tx = transactionsRepo.getById(id, userId);
    if (!tx) {
      sendError(res, 404, 'transaction.not_found');
      return;
    }
    if (tx.transfer_peer_id) {
      sendError(res, 400, 'transaction.use_transfers_update');
      return;
    }

    const data = parseBody(res, transactionSchema, req.body);
    if (!data) return;
    if (!resolveWritableAccount(res, accountsRepo, data.account_id, userId)) return;

    if (data.scheduled_id !== null) {
      if (!scheduledRepo.getById(data.scheduled_id, userId)) {
        sendError(res, 404, 'scheduled.not_found');
        return;
      }
    }

    transactionsRepo.update(userId, id, {
      ...data,
      description: data.description.trim(),
    });

    res.json(transactionsRepo.getWithDetails(id));
  });

  router.patch('/:id/validate', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const userId = sessionUserId(req);
    const data = parseBody(res, validateSchema, req.body);
    if (!data) return;

    if (!transactionsRepo.getById(id, userId)) {
      sendError(res, 404, 'transaction.not_found');
      return;
    }

    transactionsRepo.setValidated(userId, id, data.validated);
    res.json(transactionsRepo.getWithDetails(id));
  });

  router.delete('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const userId = sessionUserId(req);
    const tx = transactionsRepo.getById(id, userId);
    if (!tx) {
      sendError(res, 404, 'transaction.not_found');
      return;
    }
    if (tx.transfer_peer_id) {
      sendError(res, 400, 'transaction.use_transfers_delete');
      return;
    }
    if (stocksRepo.isFeesTransaction(id)) {
      sendError(res, 400, 'transaction.is_stock_fees');
      return;
    }
    const op = stocksRepo.getOperationByTransactionId(id);

    transactionsRepo.delete(userId, id);
    if (op) {
      stocksRepo.recalcPosition(op.account_id, op.ticker, userId);
    }

    res.json({ ok: true });
  });

  return router;
}
