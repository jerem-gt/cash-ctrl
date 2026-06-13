import type { Database } from 'better-sqlite3';

import { BadRequestError, HttpError, NotFoundError } from '../../lib/errors.js';
import { createAccountsRepo } from '../accounts/accounts.repo';
import { createStocksRepo } from '../stocks/stocks.repo';
import { createTransactionsRepo } from '../transactions/transactions.repo';
import { createTransfersRepo } from './transfers.repo';
import type { TransferInput, UpdateTransferInput } from './transfers.types';

function resolveTransferAccountIds(
  isExpense: boolean,
  from_account_id: number | undefined,
  to_account_id: number | undefined,
): { thisAccountId: number | undefined; peerAccountId: number | undefined } {
  const [thisAccountId, peerAccountId] = isExpense
    ? [from_account_id, to_account_id]
    : [to_account_id, from_account_id];
  return { thisAccountId, peerAccountId };
}

export function transferCreate(db: Database, userId: number, data: TransferInput) {
  const transfersRepo = createTransfersRepo(db);
  const accountsRepo = createAccountsRepo(db);

  if (data.from_account_id === data.to_account_id) {
    throw new BadRequestError('transfer.same_account');
  }
  if (
    !accountsRepo.exists(data.from_account_id, userId) ||
    !accountsRepo.exists(data.to_account_id, userId)
  ) {
    throw new HttpError(403, 'account.not_found');
  }

  return transfersRepo.create(userId, data);
}

export function transferUpdate(
  db: Database,
  userId: number,
  id: number,
  data: UpdateTransferInput,
) {
  const transactionsRepo = createTransactionsRepo(db);
  const transfersRepo = createTransfersRepo(db);
  const accountsRepo = createAccountsRepo(db);

  const tx = transactionsRepo.getById(id, userId);
  if (!tx) throw new NotFoundError('transaction.not_found');
  if (!tx.transfer_peer_id) throw new BadRequestError('transfer.not_a_transfer_update');

  if (data.from_account_id && !accountsRepo.exists(data.from_account_id, userId)) {
    throw new HttpError(403, 'account.not_found');
  }
  if (data.to_account_id && !accountsRepo.exists(data.to_account_id, userId)) {
    throw new HttpError(403, 'account.not_found');
  }

  const { thisAccountId, peerAccountId } = resolveTransferAccountIds(
    tx.type === 'expense',
    data.from_account_id,
    data.to_account_id,
  );

  transfersRepo.updateBothShared(userId, id, tx.transfer_peer_id, {
    amount: data.amount,
    description: data.description.trim(),
    date: data.date,
    validated: data.validated,
    this_account_id: thisAccountId,
    peer_account_id: peerAccountId,
  });

  return transactionsRepo.getWithDetails(id);
}

export function transferDelete(db: Database, userId: number, id: number) {
  const transactionsRepo = createTransactionsRepo(db);
  const transfersRepo = createTransfersRepo(db);
  const stocksRepo = createStocksRepo(db);

  const tx = transactionsRepo.getById(id, userId);
  if (!tx) throw new NotFoundError('transaction.not_found');
  if (!tx.transfer_peer_id) throw new BadRequestError('transfer.not_a_transfer_delete');

  const opThis = stocksRepo.getOperationByTransactionId(id);
  const opPeer = stocksRepo.getOperationByTransactionId(tx.transfer_peer_id);

  transfersRepo.deleteWithPeer(userId, id, tx.transfer_peer_id);

  for (const op of [opThis, opPeer]) {
    if (op) stocksRepo.recalcPosition(op.account_id, op.ticker, userId);
  }
}
