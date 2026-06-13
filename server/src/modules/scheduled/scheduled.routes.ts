import type { Database } from 'better-sqlite3';
import { Response, Router } from 'express';
import { z } from 'zod';

import { RECURRENCE_UNITS, TRANSACTION_TYPES, WEEKEND_HANDLING } from '../../constants';
import { getAccountEnvelopeType } from '../../lib/accountHelpers.js';
import { getTransferIds } from '../../lib/administrationDataConstants';
import { generateScheduledTransactions } from '../../lib/generateScheduled.js';
import { parseBody, parseNumberParam, sendError } from '../../lib/routeHelpers';
import {
  dateSchema,
  descriptionSchema,
  feesSchema,
  optionalDateSchema,
  positiveAmountSchema,
} from '../../lib/validators';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createScheduledRepo } from './scheduled.repo';

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

type ScheduledData = z.infer<typeof scheduledSchema>;

function checkTransferConstraints(
  d: ScheduledData,
  transferPmId: number | undefined,
  res: Response,
): boolean {
  if (d.payment_method_id != transferPmId) return true;
  if (!d.to_account_id) {
    sendError(res, 400, 'scheduled.destination_required');
    return false;
  }
  if (d.to_account_id === d.account_id) {
    sendError(res, 400, 'transfer.same_account');
    return false;
  }
  return true;
}

function checkVersementConstraints(db: Database, d: ScheduledData, res: Response): boolean {
  if (d.insurance_support_id == null) return true;
  const envelopeType = getAccountEnvelopeType(db, d.account_id);
  if (envelopeType !== 'life_insurance' && envelopeType !== 'per') {
    sendError(res, 400, 'scheduled.account_must_be_av_per');
    return false;
  }
  if (!d.to_account_id) {
    sendError(res, 400, 'scheduled.source_required_versement');
    return false;
  }
  const support = db
    .prepare('SELECT id FROM insurance_supports WHERE id = ? AND account_id = ?')
    .get(d.insurance_support_id, d.account_id);
  if (!support) {
    sendError(res, 400, 'insurance.support_not_found');
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
    const data = parseBody(res, scheduledSchema, req.body);
    if (!data) return;

    const userId = sessionUserId(req);
    const transferIds = getTransferIds(db, userId);
    if (!checkTransferConstraints(data, transferIds.paymentMethodId, res)) return;
    if (!checkVersementConstraints(db, data, res)) return;

    const result = scheduledRepo.create(userId, { ...data, description: data.description.trim() });
    generateScheduledTransactions(userId, db);
    res.status(201).json(scheduledRepo.getById(Number(result.lastInsertRowid), userId));
  });

  router.put('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const userId = sessionUserId(req);

    if (!scheduledRepo.exists(id, userId)) {
      sendError(res, 404, 'scheduled.not_found');
      return;
    }

    const data = parseBody(res, scheduledSchema, req.body);
    if (!data) return;

    const transferIds = getTransferIds(db, userId);
    if (!checkTransferConstraints(data, transferIds.paymentMethodId, res)) return;
    if (!checkVersementConstraints(db, data, res)) return;

    scheduledRepo.update(id, userId, { ...data, description: data.description.trim() });
    generateScheduledTransactions(userId, db);
    res.json(scheduledRepo.getById(id, userId));
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
