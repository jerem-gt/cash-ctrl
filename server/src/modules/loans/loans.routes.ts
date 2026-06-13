import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { handleHttpErrors, parseBody, parseNumberParam, sendError } from '../../lib/routeHelpers';
import {
  dateSchema,
  nameSchema,
  optionalDateSchema,
  positiveAmountSchema,
} from '../../lib/validators';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createLoansRepo } from './loans.repo.js';
import { loanCreate, loanUpdate } from './loans.service.js';

const createLoanSchema = z.object({
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

const updateLoanSchema = z.object({
  name: nameSchema,
  bank_id: z.number().int().positive().nullable().default(null),
  opening_date: optionalDateSchema,
  source_account_id: z.number().int().positive(),
});

const updateInstallmentSchema = z.object({
  due_date: dateSchema,
  total_amount: positiveAmountSchema,
});

export function createLoansRouter(db: Database): Router {
  const loansRepo = createLoansRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.post('/', (req, res) => {
    const data = parseBody(res, createLoanSchema, req.body);
    if (!data) return;
    handleHttpErrors(res, () => {
      res.status(201).json(loanCreate(db, sessionUserId(req), data));
    });
  });

  router.patch('/:loanId', (req, res) => {
    const loanId = parseNumberParam(req, res, 'loanId');
    if (loanId === null) return;
    const data = parseBody(res, updateLoanSchema, req.body);
    if (!data) return;
    handleHttpErrors(res, () => {
      res.json(loanUpdate(db, sessionUserId(req), loanId, data));
    });
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
