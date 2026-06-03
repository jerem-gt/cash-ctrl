import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { HttpError } from '../../lib/errors';
import { generateScheduledTransactions } from '../../lib/generateScheduled.js';
import { parseBody, parseNumberParam, sendError } from '../../lib/routeHelpers';
import { dateSchema, optionalDateSchema } from '../../lib/validators';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createLoansRepo } from './loans.repo.js';

const createLoanSchema = z.object({
  name: z.string().min(1).max(100),
  bank_id: z.number().int().positive().nullable().default(null),
  opening_date: optionalDateSchema,
  principal_amount: z.number().positive(),
  interest_rate: z.number().min(0).max(1),
  duration_months: z.number().int().min(1).max(600),
  start_date: dateSchema,
  source_account_id: z.number().int().positive(),
  deposit_account_id: z.number().int().positive(),
});

const updateLoanSchema = z.object({
  name: z.string().min(1).max(100),
  bank_id: z.number().int().positive().nullable().default(null),
  opening_date: optionalDateSchema,
  source_account_id: z.number().int().positive(),
});

const updateInstallmentSchema = z.object({
  due_date: dateSchema,
  total_amount: z.number().positive(),
});

export function createLoansRouter(db: Database): Router {
  const loansRepo = createLoansRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.post('/', (req, res) => {
    const data = parseBody(res, createLoanSchema, req.body);
    if (!data) return;
    try {
      const userId = sessionUserId(req);
      const loan = loansRepo.create(userId, data);
      generateScheduledTransactions(userId, db);
      res.status(201).json(loan);
    } catch (e) {
      if (e instanceof HttpError) {
        sendError(res, e.status, e.code, e.params);
      } else {
        sendError(res, 400, 'common.invalid_request');
      }
    }
  });

  router.patch('/:loanId', (req, res) => {
    const loanId = parseNumberParam(req, res, 'loanId');
    if (loanId === null) return;
    const data = parseBody(res, updateLoanSchema, req.body);
    if (!data) return;
    const userId = sessionUserId(req);
    const result = loansRepo.updateLoan(userId, loanId, data);
    if (!result) {
      sendError(res, 404, 'loan.not_found');
      return;
    }
    generateScheduledTransactions(userId, db);
    res.json(result);
  });

  router.get('/account/:accountId', (req, res) => {
    const accountId = parseNumberParam(req, res, 'accountId');
    if (accountId === null) return;
    const loan = loansRepo.getByAccountId(accountId, sessionUserId(req));
    if (!loan) {
      sendError(res, 404, 'loan.not_found');
      return;
    }
    res.json(loan);
  });

  router.get('/:loanId/installments', (req, res) => {
    const loanId = parseNumberParam(req, res, 'loanId');
    if (loanId === null) return;
    res.json(loansRepo.getInstallments(loanId, sessionUserId(req)));
  });

  router.patch('/:loanId/installments/:installmentId', (req, res) => {
    const loanId = parseNumberParam(req, res, 'loanId');
    if (loanId === null) return;
    const installmentId = parseNumberParam(req, res, 'installmentId');
    if (installmentId === null) return;
    const data = parseBody(res, updateInstallmentSchema, req.body);
    if (!data) return;
    const result = loansRepo.updateInstallment(sessionUserId(req), loanId, installmentId, data);
    if (!result) {
      sendError(res, 404, 'loan.installment_not_found');
      return;
    }
    res.json(result);
  });

  return router;
}
