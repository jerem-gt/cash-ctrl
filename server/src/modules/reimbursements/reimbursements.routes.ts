import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { REIMBURSEMENT_STATUSES } from '../../constants.js';
import { dateStr } from '../../lib/dateUtils.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { toCents } from '../../lib/money.js';
import { parseIdParam } from '../../lib/routeHelpers.js';
import { currentUserId, requireAuth } from '../../middleware.js';
import { createTransactionsRepo } from '../transactions/transactions.repo.js';
import { createReimbursementsRepo } from './reimbursements.repo.js';

export const linkSchema = z.object({
  linked_transaction_id: z.number().int().positive(),
  attributed_amount: z.number().positive().optional(),
});

export const statusSchema = z.object({
  reimbursement_status: z.enum(REIMBURSEMENT_STATUSES).nullable(),
});

export const attributedAmountSchema = z.object({
  attributed_amount: z.number().positive().nullable(),
});

export function createReimbursementsRouter(db: Database): Router {
  const repo = createReimbursementsRepo(db);
  const txRepo = createTransactionsRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/pending', (_req, res) => {
    const userId = currentUserId(res);
    res.json(repo.getPendingWithSummary(userId));
  });

  router.get('/recent', (_req, res) => {
    const userId = currentUserId(res);
    const since = dateStr(new Date(Date.now() - 180 * 24 * 60 * 60 * 1000));
    res.json(repo.getRecentCompleted(userId, since));
  });

  router.get('/:transactionId', (req, res) => {
    const transactionId = parseIdParam(req, 'transactionId');
    const userId = currentUserId(res);
    res.json(repo.getByTransactionId(transactionId, userId));
  });

  router.post('/:transactionId', (req, res) => {
    const transactionId = parseIdParam(req, 'transactionId');
    const userId = currentUserId(res);

    const data = linkSchema.parse(req.body);

    const tx = txRepo.getById(transactionId, userId);
    if (!tx) {
      throw new NotFoundError('transaction.not_found');
    }
    if (tx.type !== 'expense') {
      throw new BadRequestError('reimbursement.only_expense');
    }

    const linkedTx = txRepo.getById(data.linked_transaction_id, userId);
    if (!linkedTx) {
      throw new NotFoundError('reimbursement.linked_not_found');
    }
    if (linkedTx.type !== 'income') {
      throw new BadRequestError('reimbursement.linked_must_be_income');
    }

    const attributedAmount =
      data.attributed_amount == null ? null : toCents(data.attributed_amount);
    repo.link(userId, transactionId, data.linked_transaction_id, attributedAmount);
    res.status(201).json(repo.getByTransactionId(transactionId, userId));
  });

  router.patch('/:transactionId/status', (req, res) => {
    const transactionId = parseIdParam(req, 'transactionId');
    const userId = currentUserId(res);

    const data = statusSchema.parse(req.body);

    if (!txRepo.getById(transactionId, userId)) {
      throw new NotFoundError('transaction.not_found');
    }

    txRepo.setReimbursementStatus(userId, transactionId, data.reimbursement_status);
    res.json(txRepo.getWithDetails(transactionId));
  });

  router.patch('/:transactionId/:linkedId', (req, res) => {
    const transactionId = parseIdParam(req, 'transactionId');
    const linkedId = parseIdParam(req, 'linkedId');
    const userId = currentUserId(res);

    const data = attributedAmountSchema.parse(req.body);

    if (!txRepo.getById(transactionId, userId)) {
      throw new NotFoundError('transaction.not_found');
    }

    const attributedAmount =
      data.attributed_amount == null ? null : toCents(data.attributed_amount);
    repo.updateAttributedAmount(transactionId, linkedId, attributedAmount);
    res.json(repo.getByTransactionId(transactionId, userId));
  });

  router.delete('/:transactionId/:linkedId', (req, res) => {
    const transactionId = parseIdParam(req, 'transactionId');
    const linkedId = parseIdParam(req, 'linkedId');
    const userId = currentUserId(res);

    if (!txRepo.getById(transactionId, userId)) {
      throw new NotFoundError('transaction.not_found');
    }

    repo.unlink(transactionId, linkedId);
    res.json({ ok: true });
  });

  return router;
}
