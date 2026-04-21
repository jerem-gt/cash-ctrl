import { Router } from 'express';
import { z } from 'zod';
import { db, queries } from '../db.js';
import { requireAuth } from '../middleware.js';

export const transfersRouter = Router();
transfersRouter.use(requireAuth);

const transferSchema = z.object({
  from_account_id: z.number().int().positive(),
  to_account_id:   z.number().int().positive(),
  amount:      z.number().positive(),
  description: z.string().min(1).max(200).default('Transfert'),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const TX_QUERY = `
  SELECT t.*, a.name as account_name
  FROM transactions t JOIN accounts a ON t.account_id = a.id
  WHERE t.id = ?
`;

transfersRouter.post('/', (req, res) => {
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

  const fromAccount = queries.getAccountById.get(from_account_id, userId);
  const toAccount   = queries.getAccountById.get(to_account_id, userId);
  if (!fromAccount || !toAccount) {
    res.status(403).json({ error: 'Compte introuvable' });
    return;
  }

  const createPair = db.transaction(() => {
    const expenseId = Number(queries.insertTransaction.run(
      userId, from_account_id, 'expense', amount, description.trim(), 'Transfert', date, 'Transfert', null
    ).lastInsertRowid);

    const incomeId = Number(queries.insertTransaction.run(
      userId, to_account_id, 'income', amount, description.trim(), 'Transfert', date, 'Transfert', null
    ).lastInsertRowid);

    queries.setPeerTransfer.run(incomeId, expenseId);
    queries.setPeerTransfer.run(expenseId, incomeId);

    return {
      expense: db.prepare(TX_QUERY).get(expenseId),
      income:  db.prepare(TX_QUERY).get(incomeId),
    };
  });

  res.status(201).json(createPair());
});
