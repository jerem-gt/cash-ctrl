import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { handleHttpErrors, parseBody, parseNumberParam } from '../../lib/routeHelpers';
import { dateSchema, descriptionSchema, positiveAmountSchema } from '../../lib/validators';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { transferCreate, transferDelete, transferUpdate } from './transfers.service';

const transferSchema = z.object({
  from_account_id: z.number().int().positive(),
  to_account_id: z.number().int().positive(),
  amount: positiveAmountSchema,
  description: descriptionSchema.default('Transfert'),
  date: dateSchema,
  notes: z.string().max(1000).nullish().default(null),
  validated: z.boolean().default(false),
});

const transferUpdateSchema = z.object({
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
    const data = parseBody(res, transferSchema, req.body);
    if (!data) return;
    handleHttpErrors(res, () => {
      res.status(201).json(transferCreate(db, sessionUserId(req), data));
    });
  });

  router.put('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const data = parseBody(res, transferUpdateSchema, req.body);
    if (!data) return;
    handleHttpErrors(res, () => {
      res.json(transferUpdate(db, sessionUserId(req), id, data));
    });
  });

  router.delete('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    handleHttpErrors(res, () => {
      transferDelete(db, sessionUserId(req), id);
      res.json({ ok: true });
    });
  });

  return router;
}
