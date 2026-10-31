import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { parseIdParam } from '../../lib/routeHelpers.js';
import { dateSchema, descriptionSchema, positiveAmountSchema } from '../../lib/validators.js';
import { currentUserId, requireAuth } from '../../middleware.js';
import { transferCreate, transferDelete, transferUpdate } from './transfers.service.js';

export const transferSchema = z.object({
  from_account_id: z.number().int().positive(),
  to_account_id: z.number().int().positive(),
  amount: positiveAmountSchema,
  description: descriptionSchema.default('Transfert'),
  date: dateSchema,
  notes: z.string().max(1000).nullish().default(null),
  validated: z.boolean().default(false),
});

export const transferUpdateSchema = z.object({
  amount: positiveAmountSchema,
  description: descriptionSchema,
  date: dateSchema,
  validated: z.boolean().default(false),
  from_account_id: z.number().int().positive().optional(),
  to_account_id: z.number().int().positive().optional(),
});

export function createTransfersRouter(db: Database): Router {
  const router = Router();
  router.use(requireAuth);

  router.post('/', (req, res) => {
    const data = transferSchema.parse(req.body);
    res.status(201).json(transferCreate(db, currentUserId(res), data));
  });

  router.put('/:id', (req, res) => {
    const id = parseIdParam(req);
    const data = transferUpdateSchema.parse(req.body);
    res.json(transferUpdate(db, currentUserId(res), id, data));
  });

  router.delete('/:id', (req, res) => {
    const id = parseIdParam(req);
    transferDelete(db, currentUserId(res), id);
    res.status(204).end();
  });

  return router;
}
