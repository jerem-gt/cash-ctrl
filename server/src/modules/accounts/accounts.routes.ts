import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../../middleware.js';
import { createAccountsRepo } from './accounts.repo';

const accountSchema = z.object({
  name:            z.string().min(1).max(100),
  bank_id:         z.number().int().positive().nullable().default(null),
  account_type_id: z.number().int().positive().nullable().default(null),
  initial_balance: z.coerce.number().default(0),
  opening_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis'),
});

export function createAccountsRouter(db: Database): Router {
  const accountsRepo = createAccountsRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const userId = req.session.userId!;
    res.json(accountsRepo.getByUserId(userId));
  });

  router.post('/', (req, res) => {
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    const userId = req.session.userId!;
    const result = accountsRepo.create(userId, parsed.data);
    res.status(201).json(accountsRepo.getById(Number(result.lastInsertRowid), userId));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const userId = req.session.userId!;
    if (!accountsRepo.getById(id, userId)) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    accountsRepo.update(userId, id, parsed.data);
    res.json(accountsRepo.getById(id, userId));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const userId = req.session.userId!;
    if (!accountsRepo.getById(id, userId)) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    accountsRepo.delete(userId, id);
    res.json({ ok: true });
  });

  return router;
}
