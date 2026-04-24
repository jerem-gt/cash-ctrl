import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { generateScheduledTransactions } from '../../lib/generateScheduled.js';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createTransactionsRepo } from './transactions.repo';

const transactionSchema = z.object({
  account_id: z.number().int().positive(),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive(),
  description: z.string().min(1).max(200),
  category_id: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payment_method_id: z.number().int().positive(),
  notes: z.string().max(1000).nullable().default(null),
  validated: z.boolean().default(false),
});

const transferUpdateSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validated: z.boolean().default(false),
});

const querySchema = z.object({
  account_id: z.coerce.number().int().optional(),
  type: z.enum(['income', 'expense']).optional(),
  category_id: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(10000).default(25),
});

export function createTransactionsRouter(db: Database): Router {
  const transactionsRepo = createTransactionsRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const userId = sessionUserId(req);
    generateScheduledTransactions(userId, db);

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    res.json(transactionsRepo.getByUserId(userId, parsed.data));
  });

  router.post('/', (req, res) => {
    const parsed = transactionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    const userId = sessionUserId(req);

    if (!transactionsRepo.accountExists(parsed.data.account_id, userId)) {
      res.status(403).json({ error: 'Account not found or does not belong to user' });
      return;
    }

    const result = transactionsRepo.create(userId, {
      ...parsed.data,
      description: parsed.data.description.trim(),
    });
    res.status(201).json(transactionsRepo.getWithDetails(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const userId = sessionUserId(req);

    const tx = transactionsRepo.getById(id, userId);
    if (!tx) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    if (tx.transfer_peer_id) {
      const parsed = transferUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: z.treeifyError(parsed.error) });
        return;
      }
      transactionsRepo.updateBothShared(userId, id, tx.transfer_peer_id, {
        amount: parsed.data.amount,
        description: parsed.data.description.trim(),
        date: parsed.data.date,
        validated: parsed.data.validated,
      });
    } else {
      const parsed = transactionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: z.treeifyError(parsed.error) });
        return;
      }
      if (!transactionsRepo.accountExists(parsed.data.account_id, userId)) {
        res.status(403).json({ error: 'Account not found or does not belong to user' });
        return;
      }
      transactionsRepo.update(userId, id, {
        ...parsed.data,
        description: parsed.data.description.trim(),
      });
    }

    res.json(transactionsRepo.getWithDetails(id));
  });

  router.patch('/:id/validate', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const userId = sessionUserId(req);
    const parsed = z.object({ validated: z.boolean() }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    if (!transactionsRepo.getById(id, userId)) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    transactionsRepo.setValidated(userId, id, parsed.data.validated);
    res.json(transactionsRepo.getWithDetails(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const userId = sessionUserId(req);
    const tx = transactionsRepo.getById(id, userId);
    if (!tx) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    if (tx.transfer_peer_id) {
      transactionsRepo.deleteWithPeer(userId, id, tx.transfer_peer_id);
    } else {
      transactionsRepo.delete(userId, id);
    }

    res.json({ ok: true });
  });

  return router;
}
