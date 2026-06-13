import type { Database } from 'better-sqlite3';

import { type EnvelopeType } from '../../constants';
import { BadRequestError, HttpError, NotFoundError } from '../../lib/errors.js';
import { createAccountsRepo } from '../accounts/accounts.repo';
import { createScheduledRepo } from '../scheduled/scheduled.repo';
import { createStocksRepo } from '../stocks/stocks.repo';
import { createTransactionsRepo } from './transactions.repo';
import type { CreateTransactionInput } from './transactions.types';

const NO_DIRECT_WRITE_ENVELOPES = new Set<EnvelopeType>(['life_insurance', 'per']);

function assertWritableAccount(
  accountsRepo: ReturnType<typeof createAccountsRepo>,
  accountId: number,
  userId: number,
) {
  const account = accountsRepo.getById(accountId, userId);
  if (!account) throw new HttpError(403, 'account.not_found_or_not_owned');
  if (NO_DIRECT_WRITE_ENVELOPES.has(account.envelope_type as EnvelopeType)) {
    throw new BadRequestError('transaction.no_direct_on_av_per');
  }
  return account;
}

export function transactionCreate(db: Database, userId: number, data: CreateTransactionInput) {
  const transactionsRepo = createTransactionsRepo(db);
  const accountsRepo = createAccountsRepo(db);
  assertWritableAccount(accountsRepo, data.account_id, userId);
  const result = transactionsRepo.create(userId, {
    ...data,
    description: data.description.trim(),
  });
  return transactionsRepo.getWithDetails(Number(result.lastInsertRowid));
}

export function transactionUpdate(
  db: Database,
  userId: number,
  id: number,
  data: CreateTransactionInput,
) {
  const transactionsRepo = createTransactionsRepo(db);
  const accountsRepo = createAccountsRepo(db);
  const scheduledRepo = createScheduledRepo(db);

  const tx = transactionsRepo.getById(id, userId);
  if (!tx) throw new NotFoundError('transaction.not_found');
  if (tx.transfer_peer_id) throw new BadRequestError('transaction.use_transfers_update');

  assertWritableAccount(accountsRepo, data.account_id, userId);

  if (data.scheduled_id != null) {
    if (!scheduledRepo.getById(data.scheduled_id, userId)) {
      throw new NotFoundError('scheduled.not_found');
    }
  }

  transactionsRepo.update(userId, id, {
    ...data,
    description: data.description.trim(),
  });
  return transactionsRepo.getWithDetails(id);
}

export function transactionDelete(db: Database, userId: number, id: number) {
  const transactionsRepo = createTransactionsRepo(db);
  const stocksRepo = createStocksRepo(db);

  const tx = transactionsRepo.getById(id, userId);
  if (!tx) throw new NotFoundError('transaction.not_found');
  if (tx.transfer_peer_id) throw new BadRequestError('transaction.use_transfers_delete');
  if (stocksRepo.isFeesTransaction(id)) throw new BadRequestError('transaction.is_stock_fees');

  const op = stocksRepo.getOperationByTransactionId(id);
  transactionsRepo.delete(userId, id);
  if (op) stocksRepo.recalcPosition(op.account_id, op.ticker, userId);
}
