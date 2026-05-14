import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, sessionUserId } from '../../middleware.js';
import { createLoansRepo } from '../loans/loans.repo.js';
import { createTransfersRepo } from '../transfers/transfers.repo';
import { createAccountsRepo } from './accounts.repo';

const accountSchema = z.object({
  name: z.string().min(1).max(100),
  bank_id: z.number().int().positive().nullable().default(null),
  account_type_id: z.number().int().positive().nullable().default(null),
  initial_balance: z.coerce.number().default(0),
  opening_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis')
    .nullable()
    .default(null),
});

export function createAccountsRouter(db: Database): Router {
  const accountsRepo = createAccountsRepo(db);
  const loansRepo = createLoansRepo(db);
  const transfersRepo = createTransfersRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    res.json(accountsRepo.getByUserId(sessionUserId(req)));
  });

  router.post('/', (req, res) => {
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    const userId = sessionUserId(req);
    const result = accountsRepo.create(userId, parsed.data);
    res.status(201).json(accountsRepo.getById(Number(result.lastInsertRowid), userId));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const userId = sessionUserId(req);
    if (!accountsRepo.getById(id, userId)) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    accountsRepo.update(userId, id, parsed.data);
    res.json(accountsRepo.getById(id, userId));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const userId = sessionUserId(req);
    const account = accountsRepo.getById(id, userId);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    if (account.envelope_type === 'loan') {
      loansRepo.cleanupTransactions(id);
    }
    accountsRepo.delete(userId, id);
    res.json({ ok: true });
  });

  const closeSchema = z.object({
    closed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis'),
    transfer_to_account_id: z.number().int().positive().optional(),
  });

  router.post('/:id/close', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const userId = sessionUserId(req);
    const account = accountsRepo.getById(id, userId);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    if (account.closed_at) {
      res.status(400).json({ error: 'Ce compte est déjà clôturé' });
      return;
    }
    const parsed = closeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    const balance = Math.round(account.balance * 100) / 100;
    if (balance !== 0 && !parsed.data.transfer_to_account_id) {
      res
        .status(400)
        .json({ error: 'Le solde doit être nul ou un compte de destination est requis' });
      return;
    }

    // Transfert à faire avant clôture
    db.transaction(() => {
      if (balance !== 0 && parsed.data.transfer_to_account_id) {
        const description = `Virement de clôture — ${account.name}`;
        const amount = Math.abs(balance);
        const [fromId, toId] =
          balance > 0
            ? [id, parsed.data.transfer_to_account_id]
            : [parsed.data.transfer_to_account_id, id];
        transfersRepo.create(userId, {
          amount: amount,
          date: parsed.data.closed_at,
          description: description,
          from_account_id: fromId,
          to_account_id: toId,
          validated: true,
        });
      }
      accountsRepo.close(userId, id, parsed.data);
    })();
    res.json(accountsRepo.getById(id, userId));
  });

  router.post('/:id/reopen', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const userId = sessionUserId(req);
    const account = accountsRepo.getById(id, userId);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    if (!account.closed_at) {
      res.status(400).json({ error: "Ce compte n'est pas clôturé" });
      return;
    }
    accountsRepo.reopen(userId, id);
    res.json(accountsRepo.getById(id, userId));
  });

  return router;
}
