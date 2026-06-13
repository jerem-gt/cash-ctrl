import type { Database } from 'better-sqlite3';

import { NotFoundError } from '../../lib/errors.js';
import { generateScheduledTransactions } from '../../lib/generateScheduled.js';
import { createLoansRepo } from './loans.repo.js';
import type { CreateLoanInput, UpdateLoanInput } from './loans.types.js';

export function loanCreate(db: Database, userId: number, data: CreateLoanInput) {
  const repo = createLoansRepo(db);
  const loan = repo.create(userId, data);
  generateScheduledTransactions(userId, db);
  return loan;
}

export function loanUpdate(db: Database, userId: number, loanId: number, data: UpdateLoanInput) {
  const repo = createLoansRepo(db);
  const result = repo.updateLoan(userId, loanId, data);
  if (!result) throw new NotFoundError('loan.not_found');
  generateScheduledTransactions(userId, db);
  return result;
}
