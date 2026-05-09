import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { generateScheduledTransactions } from '../../lib/generateScheduled.js';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createLoansRepo } from './loans.repo.js';

const createLoanSchema = z.object({
  name: z.string().min(1).max(100),
  bank_id: z.number().int().positive().nullable().default(null),
  opening_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis')
    .nullable()
    .default(null),
  principal_amount: z.number().positive(),
  interest_rate: z.number().min(0).max(1),
  duration_months: z.number().int().min(1).max(600),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis'),
  source_account_id: z.number().int().positive(),
  deposit_account_id: z.number().int().positive(),
});

const updateLoanSchema = z.object({
  name: z.string().min(1).max(100),
  bank_id: z.number().int().positive().nullable().default(null),
  opening_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis')
    .nullable()
    .default(null),
  source_account_id: z.number().int().positive(),
});

const updateInstallmentSchema = z.object({
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis'),
  total_amount: z.number().positive(),
});

export function createLoansRouter(db: Database): Router {
  const loansRepo = createLoansRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.post('/', (req, res) => {
    const parsed = createLoanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    try {
      const userId = sessionUserId(req);
      const loan = loansRepo.create(userId, parsed.data);
      generateScheduledTransactions(userId, db);
      res.status(201).json(loan);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Erreur' });
    }
  });

  router.patch('/:loanId', (req, res) => {
    const loanId = Number.parseInt(req.params.loanId);
    const parsed = updateLoanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    const userId = sessionUserId(req);
    const result = loansRepo.updateLoan(userId, loanId, parsed.data);
    if (!result) {
      res.status(404).json({ error: 'Prêt introuvable' });
      return;
    }
    generateScheduledTransactions(userId, db);
    res.json(result);
  });

  router.get('/account/:accountId', (req, res) => {
    const accountId = Number.parseInt(req.params.accountId);
    const loan = loansRepo.getByAccountId(accountId, sessionUserId(req));
    if (!loan) {
      res.status(404).json({ error: 'Prêt introuvable' });
      return;
    }
    res.json(loan);
  });

  router.get('/:loanId/installments', (req, res) => {
    const loanId = Number.parseInt(req.params.loanId);
    res.json(loansRepo.getInstallments(loanId, sessionUserId(req)));
  });

  router.patch('/:loanId/installments/:installmentId', (req, res) => {
    const loanId = Number.parseInt(req.params.loanId);
    const installmentId = Number.parseInt(req.params.installmentId);
    const parsed = updateInstallmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    const result = loansRepo.updateInstallment(
      sessionUserId(req),
      loanId,
      installmentId,
      parsed.data,
    );
    if (!result) {
      res.status(404).json({ error: 'Mensualité introuvable' });
      return;
    }
    res.json(result);
  });

  return router;
}
