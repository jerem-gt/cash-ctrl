import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, sessionUserId } from '../../middleware.js';
import { createTransfersRepo } from './transfers.repo';

const transferSchema = z.object({
  from_account_id: z.number().int().positive(),
  to_account_id: z.number().int().positive(),
  amount: z.number().positive(),
  description: z.string().min(1).max(200).default('Transfert'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(1000).nullish().default(null),
  validated: z.boolean().default(false),
});

export function createTransfersRouter(db: Database): Router {
  const transfersRepo = createTransfersRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.post('/', (req, res) => {
    const parsed = transferSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    const { from_account_id, to_account_id, amount, description, date, notes, validated } =
      parsed.data;
    const userId = sessionUserId(req);

    if (from_account_id === to_account_id) {
      res.status(400).json({ error: 'Les deux comptes doivent être différents' });
      return;
    }

    if (
      !transfersRepo.accountExists(from_account_id, userId) ||
      !transfersRepo.accountExists(to_account_id, userId)
    ) {
      res.status(403).json({ error: 'Compte introuvable' });
      return;
    }

    res.status(201).json(
      transfersRepo.create(userId, {
        from_account_id,
        to_account_id,
        amount,
        description,
        date,
        notes,
        validated,
      }),
    );
  });

  return router;
}
