import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { REIMBURSEMENT_STATUSES } from '../../constants';
import { dateStr } from '../../lib/dateUtils';
import { toCents } from '../../lib/money';
import { parseBody, parseNumberParam, sendError } from '../../lib/routeHelpers';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createTransactionsRepo } from '../transactions/transactions.repo.js';
import { createReimbursementsRepo } from './reimbursements.repo';

const linkSchema = z.object({
  linked_transaction_id: z.number().int().positive(),
  attributed_amount: z.number().positive().optional(),
});

const statusSchema = z.object({
  reimbursement_status: z.enum(REIMBURSEMENT_STATUSES).nullable(),
});

const attributedAmountSchema = z.object({
  attributed_amount: z.number().positive().nullable(),
});

export function createReimbursementsRouter(db: Database): Router {
  const repo = createReimbursementsRepo(db);
  const txRepo = createTransactionsRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/pending', (req, res) => {
    const userId = sessionUserId(req);
    res.json(repo.getPendingWithSummary(userId));
  });

  router.get('/recent', (req, res) => {
    const userId = sessionUserId(req);
    const since = dateStr(new Date(Date.now() - 180 * 24 * 60 * 60 * 1000));
    res.json(repo.getRecentCompleted(userId, since));
  });

  router.get('/:transactionId', (req, res) => {
    const transactionId = parseNumberParam(req, res, 'transactionId');
    if (transactionId === null) return;
    const userId = sessionUserId(req);
    res.json(repo.getByTransactionId(transactionId, userId));
  });

  router.post('/:transactionId', (req, res) => {
    const transactionId = parseNumberParam(req, res, 'transactionId');
    if (transactionId === null) return;
    const userId = sessionUserId(req);

    const data = parseBody(res, linkSchema, req.body);
    if (!data) return;

    const tx = txRepo.getById(transactionId, userId);
    if (!tx) {
      sendError(res, 404, 'transaction.not_found');
      return;
    }
    if (tx.type !== 'expense') {
      sendError(res, 400, 'reimbursement.only_expense');
      return;
    }

    const linkedTx = txRepo.getById(data.linked_transaction_id, userId);
    if (!linkedTx) {
      sendError(res, 404, 'reimbursement.linked_not_found');
      return;
    }
    if (linkedTx.type !== 'income') {
      sendError(res, 400, 'reimbursement.linked_must_be_income');
      return;
    }

    const attributedAmount =
      data.attributed_amount == null ? null : toCents(data.attributed_amount);
    repo.link(userId, transactionId, data.linked_transaction_id, attributedAmount);
    res.status(201).json(repo.getByTransactionId(transactionId, userId));
  });

  router.patch('/:transactionId/status', (req, res) => {
    const transactionId = parseNumberParam(req, res, 'transactionId');
    if (transactionId === null) return;
    const userId = sessionUserId(req);

    const data = parseBody(res, statusSchema, req.body);
    if (!data) return;

    if (!txRepo.getById(transactionId, userId)) {
      sendError(res, 404, 'transaction.not_found');
      return;
    }

    txRepo.setReimbursementStatus(userId, transactionId, data.reimbursement_status);
    res.json(txRepo.getWithDetails(transactionId));
  });

  router.patch('/:transactionId/:linkedId', (req, res) => {
    const transactionId = parseNumberParam(req, res, 'transactionId');
    if (transactionId === null) return;
    const linkedId = parseNumberParam(req, res, 'linkedId');
    if (linkedId === null) return;
    const userId = sessionUserId(req);

    const data = parseBody(res, attributedAmountSchema, req.body);
    if (!data) return;

    if (!txRepo.getById(transactionId, userId)) {
      sendError(res, 404, 'transaction.not_found');
      return;
    }

    const attributedAmount =
      data.attributed_amount == null ? null : toCents(data.attributed_amount);
    repo.updateAttributedAmount(transactionId, linkedId, attributedAmount);
    res.json(repo.getByTransactionId(transactionId, userId));
  });

  router.delete('/:transactionId/:linkedId', (req, res) => {
    const transactionId = parseNumberParam(req, res, 'transactionId');
    if (transactionId === null) return;
    const linkedId = parseNumberParam(req, res, 'linkedId');
    if (linkedId === null) return;
    const userId = sessionUserId(req);

    if (!txRepo.getById(transactionId, userId)) {
      sendError(res, 404, 'transaction.not_found');
      return;
    }

    repo.unlink(transactionId, linkedId);
    res.json({ ok: true });
  });

  return router;
}
