import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { parseBody, parseNumberParam } from '../../lib/routeHelpers';
import { dateSchema } from '../../lib/validators';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createAccountsRepo } from '../accounts/accounts.repo';
import { createStocksRepo } from '../stocks/stocks.repo';
import { createTransactionsRepo } from '../transactions/transactions.repo';
import { createTransfersRepo } from './transfers.repo';

const transferSchema = z.object({
  from_account_id: z.number().int().positive(),
  to_account_id: z.number().int().positive(),
  amount: z.number().positive(),
  description: z.string().min(1).max(200).default('Transfert'),
  date: dateSchema,
  notes: z.string().max(1000).nullish().default(null),
  validated: z.boolean().default(false),
});

const transferUpdateSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1).max(200),
  date: dateSchema,
  validated: z.boolean().default(false),
  from_account_id: z.number().int().positive().optional(),
  to_account_id: z.number().int().positive().optional(),
});

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

export function createTransfersRouter(db: Database): Router {
  const transfersRepo = createTransfersRepo(db);
  const transactionsRepo = createTransactionsRepo(db);
  const accountsRepo = createAccountsRepo(db);
  const stocksRepo = createStocksRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.post('/', (req, res) => {
    const data = parseBody(res, transferSchema, req.body);
    if (!data) return;

    const { from_account_id, to_account_id, amount, description, date, notes, validated } = data;
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
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const userId = sessionUserId(req);

    const tx = transactionsRepo.getById(id, userId);
    if (!tx) {
      res.status(404).json({ error: 'Transaction introuvable' });
      return;
    }
    if (!tx.transfer_peer_id) {
      res
        .status(400)
        .json({ error: "Ce n'est pas un transfert — utilisez PUT /api/transactions/:id" });
      return;
    }

    const data = parseBody(res, transferUpdateSchema, req.body);
    if (!data) return;

    const { from_account_id, to_account_id } = data;
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
      amount: data.amount,
      description: data.description.trim(),
      date: data.date,
      validated: data.validated,
      this_account_id: thisAccountId,
      peer_account_id: peerAccountId,
    });

    res.json(transactionsRepo.getWithDetails(id));
  });

  router.delete('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const userId = sessionUserId(req);

    const tx = transactionsRepo.getById(id, userId);
    if (!tx) {
      res.status(404).json({ error: 'Transaction introuvable' });
      return;
    }
    if (!tx.transfer_peer_id) {
      res
        .status(400)
        .json({ error: "Ce n'est pas un transfert — utilisez DELETE /api/transactions/:id" });
      return;
    }

    // Si le transfert porte des titres, recalculer les positions des deux comptes
    // après suppression (la cascade efface les stock_operations liées aux 2 jambes).
    const opThis = stocksRepo.getOperationByTransactionId(id);
    const opPeer = stocksRepo.getOperationByTransactionId(tx.transfer_peer_id);

    transfersRepo.deleteWithPeer(userId, id, tx.transfer_peer_id);

    for (const op of [opThis, opPeer]) {
      if (op) stocksRepo.recalcPosition(op.account_id, op.ticker, userId);
    }

    res.json({ ok: true });
  });

  return router;
}
