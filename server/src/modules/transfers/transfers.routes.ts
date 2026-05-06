import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, sessionUserId } from '../../middleware.js';
import { createAccountsRepo } from '../accounts/accounts.repo';
import { createTransactionsRepo } from '../transactions/transactions.repo';
import { createTransfersRepo } from './transfers.repo';

const transferSchema = z.object({
  from_account_id: z.number().int().positive(),
  to_account_id: z.number().int().positive(),
  amount: z.number().positive(),
  description: z.string().min(1).max(200).default('Transfert'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(1000).nullish().default(null),
  validated: z.boolean().default(false),
});

const transferUpdateSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validated: z.boolean().default(false),
  from_account_id: z.number().int().positive().optional(),
  to_account_id: z.number().int().positive().optional(),
});

function resolveTransferAccountIds(
  isExpense: boolean,
  from_account_id: number | undefined,
  to_account_id: number | undefined,
): { thisAccountId: number | undefined; peerAccountId: number | undefined } {
  const thisAccountId =
    from_account_id !== undefined ? (isExpense ? from_account_id : to_account_id) : undefined;
  const peerAccountId =
    to_account_id !== undefined ? (isExpense ? to_account_id : from_account_id) : undefined;
  return { thisAccountId, peerAccountId };
}

export function createTransfersRouter(db: Database): Router {
  const transfersRepo = createTransfersRepo(db);
  const transactionsRepo = createTransactionsRepo(db);
  const accountsRepo = createAccountsRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.post('/', (req, res) => {
    const parsed = transferSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    const { from_account_id, to_account_id, amount, description, date, notes, validated } =
      parsed.data;
    const userId = sessionUserId(req);

    if (from_account_id === to_account_id) {
      res.status(400).json({ error: 'Les deux comptes doivent être différents' });
      return;
    }

    if (
      !accountsRepo.exists(from_account_id, userId) ||
      !accountsRepo.exists(to_account_id, userId)
    ) {
      res.status(403).json({ error: 'Compte introuvable' });
      return;
    }

    res.status(201).json(
      transfersRepo.create(userId, {
        from_account_id,
        to_account_id,
        amount,
        description,
        date,
        notes,
        validated,
      }),
    );
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const userId = sessionUserId(req);

    const tx = transactionsRepo.getById(id, userId);
    if (!tx) {
      res.status(404).json({ error: 'Transaction introuvable' });
      return;
    }
    if (!tx.transfer_peer_id) {
      res.status(400).json({ error: 'Not a transfer — use PUT /api/transactions/:id' });
      return;
    }

    const parsed = transferUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    const { from_account_id, to_account_id } = parsed.data;
    if (from_account_id && !accountsRepo.exists(from_account_id, userId)) {
      res.status(403).json({ error: 'Compte introuvable' });
      return;
    }
    if (to_account_id && !accountsRepo.exists(to_account_id, userId)) {
      res.status(403).json({ error: 'Compte introuvable' });
      return;
    }

    const { thisAccountId, peerAccountId } = resolveTransferAccountIds(
      tx.type === 'expense',
      from_account_id,
      to_account_id,
    );

    transfersRepo.updateBothShared(userId, id, tx.transfer_peer_id, {
      amount: parsed.data.amount,
      description: parsed.data.description.trim(),
      date: parsed.data.date,
      validated: parsed.data.validated,
      this_account_id: thisAccountId,
      peer_account_id: peerAccountId,
    });

    res.json(transactionsRepo.getWithDetails(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const userId = sessionUserId(req);

    const tx = transactionsRepo.getById(id, userId);
    if (!tx) {
      res.status(404).json({ error: 'Transaction introuvable' });
      return;
    }
    if (!tx.transfer_peer_id) {
      res.status(400).json({ error: 'Not a transfer — use DELETE /api/transactions/:id' });
      return;
    }

    transfersRepo.deleteWithPeer(userId, id, tx.transfer_peer_id);
    res.json({ ok: true });
  });

  return router;
}
