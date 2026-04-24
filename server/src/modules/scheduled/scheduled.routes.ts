import type { Database } from 'better-sqlite3';
import { Response, Router } from 'express';
import { z } from 'zod';

import { generateScheduledTransactions } from '../../lib/generateScheduled.js';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createScheduledRepo } from './scheduled.repo';

const scheduledSchema = z.object({
  account_id: z.number().int().positive(),
  to_account_id: z.number().int().positive().nullable().default(null),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive(),
  description: z.string().min(1).max(200),
  category_id: z.number().int().positive(),
  payment_method_id: z.number().int().positive(),
  notes: z.string().max(1000).nullable().default(null),
  recurrence_unit: z.enum(['day', 'week', 'month', 'year']),
  recurrence_interval: z.number().int().min(1).default(1),
  recurrence_day: z.number().int().min(1).max(31).nullable().default(null),
  recurrence_month: z.number().int().min(1).max(12).nullable().default(null),
  weekend_handling: z.enum(['allow', 'before', 'after']).default('allow'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  active: z.boolean().default(true),
});

type ScheduledData = z.infer<typeof scheduledSchema>;

function checkTransferConstraints(
  d: ScheduledData,
  transferPmId: number | undefined,
  res: Response,
): boolean {
  if (d.payment_method_id !== transferPmId) return true;
  if (!d.to_account_id) {
    res.status(400).json({ error: 'Un compte destination est requis pour un transfert' });
    return false;
  }
  if (d.to_account_id === d.account_id) {
    res.status(400).json({ error: 'Les deux comptes doivent être différents' });
    return false;
  }
  return true;
}

export function createScheduledRouter(db: Database): Router {
  const scheduledRepo = createScheduledRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    res.json(scheduledRepo.getByUserId(sessionUserId(req)));
  });

  router.post('/', (req, res) => {
    const parsed = scheduledSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    const d = parsed.data;
    if (!checkTransferConstraints(d, scheduledRepo.getTransferPmId(), res)) return;

    const userId = sessionUserId(req);
    const result = scheduledRepo.create(userId, { ...d, description: d.description.trim() });
    generateScheduledTransactions(userId, db);
    res.status(201).json(scheduledRepo.getById(Number(result.lastInsertRowid), userId));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const userId = sessionUserId(req);

    if (!scheduledRepo.exists(id, userId)) {
      res.status(404).json({ error: 'Planification introuvable' });
      return;
    }

    const parsed = scheduledSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    const d = parsed.data;
    if (!checkTransferConstraints(d, scheduledRepo.getTransferPmId(), res)) return;

    scheduledRepo.update(userId, id, { ...d, description: d.description.trim() });
    generateScheduledTransactions(userId, db);
    res.json(scheduledRepo.getById(id, userId));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const userId = sessionUserId(req);

    if (!scheduledRepo.exists(id, userId)) {
      res.status(404).json({ error: 'Planification introuvable' });
      return;
    }

    scheduledRepo.delete(userId, id);
    res.json({ ok: true });
  });

  return router;
}
