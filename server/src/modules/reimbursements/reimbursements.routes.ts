import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { REIMBURSEMENT_STATUSES } from '../../constants';
import { toCents } from '../../lib/money';
import { parseBody, parseNumberParam } from '../../lib/routeHelpers';
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
    const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
      res.status(404).json({ error: 'Transaction introuvable' });
      return;
    }
    if (tx.type !== 'expense') {
      res.status(400).json({ error: 'Seules les dépenses peuvent avoir des remboursements' });
      return;
    }

    const linkedTx = txRepo.getById(data.linked_transaction_id, userId);
    if (!linkedTx) {
      res.status(404).json({ error: 'Transaction liée introuvable' });
      return;
    }
    if (linkedTx.type !== 'income') {
      res.status(400).json({ error: 'La transaction liée doit être un revenu' });
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
      res.status(404).json({ error: 'Transaction introuvable' });
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
      res.status(404).json({ error: 'Transaction introuvable' });
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
      res.status(404).json({ error: 'Transaction introuvable' });
      return;
    }

    repo.unlink(transactionId, linkedId);
    res.json({ ok: true });
  });

  return router;
}
