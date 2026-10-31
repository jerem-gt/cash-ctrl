import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { NotFoundError } from '../../lib/errors.js';
import { parseIdParam } from '../../lib/routeHelpers.js';
import {
  dateSchema,
  nameSchema,
  optionalDateSchema,
  positiveAmountSchema,
} from '../../lib/validators.js';
import { currentUserId, requireAuth } from '../../middleware.js';
import { createLoansRepo } from './loans.repo.js';
import { loanCreate, loanUpdate } from './loans.service.js';

export const createLoanSchema = z.object({
  name: nameSchema,
  bank_id: z.number().int().positive().nullable().default(null),
  opening_date: optionalDateSchema,
  principal_amount: positiveAmountSchema,
  interest_rate: z.number().min(0).max(1),
  duration_months: z.number().int().min(1).max(600),
  start_date: dateSchema,
  source_account_id: z.number().int().positive(),
  deposit_account_id: z.number().int().positive(),
});

export const updateLoanSchema = z.object({
  name: nameSchema,
  bank_id: z.number().int().positive().nullable().default(null),
  opening_date: optionalDateSchema,
  source_account_id: z.number().int().positive(),
});

export const updateInstallmentSchema = z.object({
  due_date: dateSchema,
  total_amount: positiveAmountSchema,
});

export function createLoansRouter(db: Database): Router {
  const loansRepo = createLoansRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.post('/', (req, res) => {
    const data = createLoanSchema.parse(req.body);
    res.status(201).json(loanCreate(db, currentUserId(res), data));
  });

  router.patch('/:loanId', (req, res) => {
    const loanId = parseIdParam(req, 'loanId');
    const data = updateLoanSchema.parse(req.body);
    res.json(loanUpdate(db, currentUserId(res), loanId, data));
  });

  router.get('/account/:accountId', (req, res) => {
    const accountId = parseIdParam(req, 'accountId');
    const loan = loansRepo.getByAccountId(accountId, currentUserId(res));
    if (!loan) {
      throw new NotFoundError('loan.not_found');
    }
    res.json(loan);
  });

  router.get('/:loanId/installments', (req, res) => {
    const loanId = parseIdParam(req, 'loanId');
    res.json(loansRepo.getInstallments(loanId, currentUserId(res)));
  });

  router.patch('/:loanId/installments/:installmentId', (req, res) => {
    const loanId = parseIdParam(req, 'loanId');
    const installmentId = parseIdParam(req, 'installmentId');
    const data = updateInstallmentSchema.parse(req.body);
    const result = loansRepo.updateInstallment(currentUserId(res), loanId, installmentId, data);
    if (!result) {
      throw new NotFoundError('loan.installment_not_found');
    }
    res.json(result);
  });

  return router;
}
