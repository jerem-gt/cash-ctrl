import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { RECURRENCE_UNITS, TRANSACTION_TYPES, WEEKEND_HANDLING } from '../../constants.js';
import { NotFoundError } from '../../lib/errors.js';
import { parseIdParam } from '../../lib/routeHelpers.js';
import {
  dateSchema,
  descriptionSchema,
  feesSchema,
  optionalDateSchema,
  positiveAmountSchema,
} from '../../lib/validators.js';
import { currentUserId, requireAuth } from '../../middleware.js';
import { createScheduledRepo } from './scheduled.repo.js';
import { scheduledCreate, scheduledUpdate } from './scheduled.service.js';

export const scheduledSchema = z.object({
  account_id: z.number().int().positive(),
  to_account_id: z.number().int().positive().nullable().default(null),
  type: z.enum(TRANSACTION_TYPES),
  amount: positiveAmountSchema,
  description: descriptionSchema,
  subcategory_id: z.number().int().positive().nullable().default(null),
  payment_method_id: z.number().int().positive().nullable().default(null),
  insurance_support_id: z.number().int().positive().nullable().default(null),
  insurance_fees: feesSchema,
  notes: z.string().max(1000).nullable().default(null),
  recurrence_unit: z.enum(RECURRENCE_UNITS),
  recurrence_interval: z.number().int().min(1).default(1),
  recurrence_day: z.number().int().min(1).max(31).nullable().default(null),
  recurrence_month: z.number().int().min(1).max(12).nullable().default(null),
  weekend_handling: z.enum(WEEKEND_HANDLING).default('allow'),
  start_date: dateSchema,
  end_date: optionalDateSchema,
  active: z.boolean().default(true),
});

export function createScheduledRouter(db: Database): Router {
  const scheduledRepo = createScheduledRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (_req, res) => {
    res.json(scheduledRepo.getByUserId(currentUserId(res)));
  });

  router.post('/', (req, res) => {
    const data = scheduledSchema.parse(req.body);
    res.status(201).json(
      scheduledCreate(db, currentUserId(res), {
        ...data,
        description: data.description.trim(),
      }),
    );
  });

  router.put('/:id', (req, res) => {
    const id = parseIdParam(req);
    const data = scheduledSchema.parse(req.body);
    res.json(
      scheduledUpdate(db, currentUserId(res), id, {
        ...data,
        description: data.description.trim(),
      }),
    );
  });

  router.delete('/:id', (req, res) => {
    const id = parseIdParam(req);
    const userId = currentUserId(res);

    if (!scheduledRepo.exists(id, userId)) {
      throw new NotFoundError('scheduled.not_found');
    }

    scheduledRepo.delete(userId, id);
    res.json({ ok: true });
  });

  return router;
}
