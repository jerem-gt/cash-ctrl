import type { Database } from 'better-sqlite3';

import { getAccountEnvelopeType } from '../../lib/accountHelpers.js';
import { getTransferIds } from '../../lib/administrationDataConstants';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { generateScheduledTransactions } from '../../lib/generateScheduled.js';
import { createScheduledRepo } from './scheduled.repo';
import type { CreateScheduledInput } from './scheduled.types';

function checkTransferConstraints(d: CreateScheduledInput, transferPmId: number | undefined): void {
  if (d.payment_method_id != transferPmId) return;
  if (!d.to_account_id) throw new BadRequestError('scheduled.destination_required');
  if (d.to_account_id === d.account_id) throw new BadRequestError('transfer.same_account');
}

function checkVersementConstraints(db: Database, d: CreateScheduledInput): void {
  if (d.insurance_support_id == null) return;
  const envelopeType = getAccountEnvelopeType(db, d.account_id);
  if (envelopeType !== 'life_insurance' && envelopeType !== 'per') {
    throw new BadRequestError('scheduled.account_must_be_av_per');
  }
  if (!d.to_account_id) throw new BadRequestError('scheduled.source_required_versement');
  const support = db
    .prepare('SELECT id FROM insurance_supports WHERE id = ? AND account_id = ?')
    .get(d.insurance_support_id, d.account_id);
  if (!support) throw new BadRequestError('insurance.support_not_found');
}

export function scheduledCreate(db: Database, userId: number, data: CreateScheduledInput) {
  const repo = createScheduledRepo(db);
  const { paymentMethodId } = getTransferIds(db, userId);
  checkTransferConstraints(data, paymentMethodId);
  checkVersementConstraints(db, data);
  const result = repo.create(userId, data);
  generateScheduledTransactions(userId, db);
  return repo.getById(Number(result.lastInsertRowid), userId)!;
}

export function scheduledUpdate(
  db: Database,
  userId: number,
  id: number,
  data: CreateScheduledInput,
) {
  const repo = createScheduledRepo(db);
  if (!repo.exists(id, userId)) throw new NotFoundError('scheduled.not_found');
  const { paymentMethodId } = getTransferIds(db, userId);
  checkTransferConstraints(data, paymentMethodId);
  checkVersementConstraints(db, data);
  repo.update(id, userId, data);
  generateScheduledTransactions(userId, db);
  return repo.getById(id, userId)!;
}
