import { Router } from 'express';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import type { Account, Transaction } from '../db.js';
import { requireAuth } from '../middleware.js';

const TX_WITH_ACCOUNT = `
  SELECT t.*, a.name as account_name
  FROM transactions t JOIN accounts a ON t.account_id = a.id
  WHERE t.id = ?
`;

const transferSchema = z.object({
  from_account_id: z.number().int().positive(),
  to_account_id:   z.number().int().positive(),
  amount:          z.number().positive(),
  description:     z.string().min(1).max(200).default('Transfert'),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export function createTransfersRouter(db: Database.Database): Router {
  const getAccountById    = db.prepare<[number, number], Account>('SELECT * FROM accounts WHERE id = ? AND user_id = ?');
  const insertTransaction = db.prepare<[number, number, string, number, string, string, string, string, null]>(
    'INSERT INTO transactions (user_id, account_id, type, amount, description, category, date, payment_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const setPeerTransfer   = db.prepare<[number, number]>('UPDATE transactions SET transfer_peer_id = ? WHERE id = ?');
  const getTxWithAccount  = db.prepare<[number], Transaction & { account_name: string }>(TX_WITH_ACCOUNT);

  const router = Router();
  router.use(requireAuth);

  router.post('/', (req, res) => {
    const parsed = transferSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    const { from_account_id, to_account_id, amount, description, date } = parsed.data;
    const userId = req.session.userId!;

    if (from_account_id === to_account_id) {
      res.status(400).json({ error: 'Les deux comptes doivent être différents' });
      return;
    }

    if (!getAccountById.get(from_account_id, userId) || !getAccountById.get(to_account_id, userId)) {
      res.status(403).json({ error: 'Compte introuvable' });
      return;
    }

    const result = db.transaction(() => {
      const expenseId = Number(insertTransaction.run(
        userId, from_account_id, 'expense', amount, description.trim(), 'Transfert', date, 'Transfert', null,
      ).lastInsertRowid);
      const incomeId = Number(insertTransaction.run(
        userId, to_account_id, 'income', amount, description.trim(), 'Transfert', date, 'Transfert', null,
      ).lastInsertRowid);
      setPeerTransfer.run(incomeId, expenseId);
      setPeerTransfer.run(expenseId, incomeId);
      return { expense: getTxWithAccount.get(expenseId), income: getTxWithAccount.get(incomeId) };
    })();

    res.status(201).json(result);
  });

  return router;
}
