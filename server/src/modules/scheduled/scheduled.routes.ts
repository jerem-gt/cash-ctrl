import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { RECURRENCE_UNITS, TRANSACTION_TYPES, WEEKEND_HANDLING } from '../../constants';
import { handleHttpErrors, parseBody, parseNumberParam, sendError } from '../../lib/routeHelpers';
import {
  dateSchema,
  descriptionSchema,
  feesSchema,
  optionalDateSchema,
  positiveAmountSchema,
} from '../../lib/validators';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createScheduledRepo } from './scheduled.repo';
import { scheduledCreate, scheduledUpdate } from './scheduled.service';

const scheduledSchema = z.object({
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

  router.get('/', (req, res) => {
    res.json(scheduledRepo.getByUserId(sessionUserId(req)));
  });

  router.post('/', (req, res) => {
    const data = parseBody(res, scheduledSchema, req.body);
    if (!data) return;
    handleHttpErrors(res, () => {
      res.status(201).json(
        scheduledCreate(db, sessionUserId(req), {
          ...data,
          description: data.description.trim(),
        }),
      );
    });
  });

  router.put('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const data = parseBody(res, scheduledSchema, req.body);
    if (!data) return;
    handleHttpErrors(res, () => {
      res.json(
        scheduledUpdate(db, sessionUserId(req), id, {
          ...data,
          description: data.description.trim(),
        }),
      );
    });
  });

  router.delete('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const userId = sessionUserId(req);

    if (!scheduledRepo.exists(id, userId)) {
      sendError(res, 404, 'scheduled.not_found');
      return;
    }

    scheduledRepo.delete(userId, id);
    res.json({ ok: true });
  });

  return router;
}
