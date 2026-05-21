import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { REIMBURSEMENT_STATUSES } from '../../constants';
import { toCents } from '../../lib/money';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createTransactionsRepo } from '../transactions/transactions.repo.js';
import { createReimbursementsRepo } from './reimbursements.repo';

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
    const transactionId = Number.parseInt(req.params.transactionId);
    const userId = sessionUserId(req);
    res.json(repo.getByTransactionId(transactionId, userId));
  });

  router.post('/:transactionId', (req, res) => {
    const transactionId = Number.parseInt(req.params.transactionId);
    const userId = sessionUserId(req);

    const parsed = z
      .object({
        linked_transaction_id: z.number().int().positive(),
        attributed_amount: z.number().positive().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    const tx = txRepo.getById(transactionId, userId);
    if (!tx) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    if (tx.type !== 'expense') {
      res.status(400).json({ error: 'Only expense transactions can have reimbursements' });
      return;
    }

    const linkedTx = txRepo.getById(parsed.data.linked_transaction_id, userId);
    if (!linkedTx) {
      res.status(404).json({ error: 'Linked transaction not found' });
      return;
    }
    if (linkedTx.type !== 'income') {
      res.status(400).json({ error: 'Linked transaction must be an income transaction' });
      return;
    }

    const attributedAmount =
      parsed.data.attributed_amount == null ? null : toCents(parsed.data.attributed_amount);
    repo.link(userId, transactionId, parsed.data.linked_transaction_id, attributedAmount);
    res.status(201).json(repo.getByTransactionId(transactionId, userId));
  });

  router.patch('/:transactionId/status', (req, res) => {
    const transactionId = Number.parseInt(req.params.transactionId);
    const userId = sessionUserId(req);

    const parsed = z
      .object({ reimbursement_status: z.enum(REIMBURSEMENT_STATUSES).nullable() })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    if (!txRepo.getById(transactionId, userId)) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    txRepo.setReimbursementStatus(userId, transactionId, parsed.data.reimbursement_status);
    res.json(txRepo.getWithDetails(transactionId));
  });

  router.patch('/:transactionId/:linkedId', (req, res) => {
    const transactionId = Number.parseInt(req.params.transactionId);
    const linkedId = Number.parseInt(req.params.linkedId);
    const userId = sessionUserId(req);

    const parsed = z
      .object({ attributed_amount: z.number().positive().nullable() })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    if (!txRepo.getById(transactionId, userId)) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    const attributedAmount =
      parsed.data.attributed_amount == null ? null : toCents(parsed.data.attributed_amount);
    repo.updateAttributedAmount(transactionId, linkedId, attributedAmount);
    res.json(repo.getByTransactionId(transactionId, userId));
  });

  router.delete('/:transactionId/:linkedId', (req, res) => {
    const transactionId = Number.parseInt(req.params.transactionId);
    const linkedId = Number.parseInt(req.params.linkedId);
    const userId = sessionUserId(req);

    if (!txRepo.getById(transactionId, userId)) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    repo.unlink(transactionId, linkedId);
    res.json({ ok: true });
  });

  return router;
}
