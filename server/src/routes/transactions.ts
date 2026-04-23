import { Router } from 'express';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import type { Account, Transaction } from '../db.js';
import { requireAuth } from '../middleware.js';
import { generateScheduledTransactions } from '../lib/generateScheduled.js';

const TX_WITH_ACCOUNT = `
  SELECT t.id, t.user_id, t.account_id, t.type, t.amount, t.description,
         t.category_id, t.payment_method_id,
         t.date, t.transfer_peer_id, t.scheduled_id, t.validated, t.notes, t.created_at,
         a.name as account_name,
         COALESCE(c.name, '') as category,
         COALESCE(pm.name, '') as payment_method
  FROM transactions t
  JOIN accounts a ON t.account_id = a.id
  LEFT JOIN categories c ON t.category_id = c.id
  LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
  WHERE t.id = ?
`;

const transactionSchema = z.object({
  account_id:        z.number().int().positive(),
  type:              z.enum(['income', 'expense']),
  amount:            z.number().positive(),
  description:       z.string().min(1).max(200),
  category_id:       z.number().int().positive(),
  date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payment_method_id: z.number().int().positive(),
  notes:             z.string().max(1000).nullable().default(null),
  validated:         z.boolean().default(false),
});

const transferUpdateSchema = z.object({
  amount:      z.number().positive(),
  description: z.string().min(1).max(200),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const querySchema = z.object({
  account_id:  z.coerce.number().int().optional(),
  type:        z.enum(['income', 'expense']).optional(),
  category_id: z.coerce.number().int().optional(),
});

export function createTransactionsRouter(db: Database.Database): Router {
  const getAccountById    = db.prepare<[number, number], Account>('SELECT * FROM accounts WHERE id = ? AND user_id = ?');
  const insertTransaction = db.prepare<[number, number, string, number, string, number | null, string, number | null, string | null]>(
    'INSERT INTO transactions (user_id, account_id, type, amount, description, category_id, date, payment_method_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const getTxWithAccount  = db.prepare<[number], Transaction & { account_name: string }>(TX_WITH_ACCOUNT);
  const getTransactionById = db.prepare<[number, number], Transaction>('SELECT * FROM transactions WHERE id = ? AND user_id = ?');
  const updateTransaction = db.prepare<[number, string, number, string, number | null, string, number | null, string | null, number, number, number]>(
    'UPDATE transactions SET account_id = ?, type = ?, amount = ?, description = ?, category_id = ?, date = ?, payment_method_id = ?, notes = ?, validated = ? WHERE id = ? AND user_id = ?',
  );
  const updateShared      = db.prepare<[number, string, string, number, number]>(
    'UPDATE transactions SET amount = ?, description = ?, date = ? WHERE id = ? AND user_id = ?',
  );
  const setValidated      = db.prepare<[number, number, number]>('UPDATE transactions SET validated = ? WHERE id = ? AND user_id = ?');
  const deleteTransaction = db.prepare<[number, number]>('DELETE FROM transactions WHERE id = ? AND user_id = ?');

  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    generateScheduledTransactions(req.session.userId!, db);

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    const { account_id, type, category_id } = parsed.data;
    let query = `
      SELECT t.id, t.user_id, t.account_id, t.type, t.amount, t.description,
             t.category_id, t.payment_method_id,
             t.date, t.transfer_peer_id, t.scheduled_id, t.validated, t.notes, t.created_at,
             a.name as account_name,
             COALESCE(c.name, '') as category,
             COALESCE(pm.name, '') as payment_method
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
      WHERE t.user_id = ?
    `;
    const params: (number | string)[] = [req.session.userId!];
    if (account_id)  { query += ' AND t.account_id = ?';  params.push(account_id); }
    if (type)        { query += ' AND t.type = ?';         params.push(type); }
    if (category_id) { query += ' AND t.category_id = ?'; params.push(category_id); }
    query += ' ORDER BY t.date DESC, t.created_at DESC';

    res.json(db.prepare(query).all(...params));
  });

  router.post('/', (req, res) => {
    const parsed = transactionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    const { account_id, type, amount, description, category_id, date, payment_method_id, notes } = parsed.data;

    if (!getAccountById.get(account_id, req.session.userId!)) {
      res.status(403).json({ error: 'Account not found or does not belong to user' });
      return;
    }

    const result = insertTransaction.run(
      req.session.userId!, account_id, type, amount, description.trim(), category_id, date, payment_method_id, notes,
    );
    res.status(201).json(getTxWithAccount.get(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const userId = req.session.userId!;

    const tx = getTransactionById.get(id, userId);
    if (!tx) { res.status(404).json({ error: 'Transaction not found' }); return; }

    if (tx.transfer_peer_id) {
      const parsed = transferUpdateSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
      const { amount, description, date } = parsed.data;
      db.transaction(() => {
        updateShared.run(amount, description.trim(), date, id, userId);
        updateShared.run(amount, description.trim(), date, tx.transfer_peer_id!, userId);
      })();
    } else {
      const parsed = transactionSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
      const { account_id, type, amount, description, category_id, date, payment_method_id, notes, validated } = parsed.data;
      if (!getAccountById.get(account_id, userId)) {
        res.status(403).json({ error: 'Account not found or does not belong to user' }); return;
      }
      updateTransaction.run(account_id, type, amount, description.trim(), category_id, date, payment_method_id, notes, validated ? 1 : 0, id, userId);
    }

    res.json(getTxWithAccount.get(id));
  });

  router.patch('/:id/validate', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const userId = req.session.userId!;
    const parsed = z.object({ validated: z.boolean() }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

    if (!getTransactionById.get(id, userId)) {
      res.status(404).json({ error: 'Transaction not found' }); return;
    }

    setValidated.run(parsed.data.validated ? 1 : 0, id, userId);
    res.json(getTxWithAccount.get(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const userId = req.session.userId!;
    const tx = getTransactionById.get(id, userId);
    if (!tx) { res.status(404).json({ error: 'Transaction not found' }); return; }

    db.transaction(() => {
      if (tx.transfer_peer_id) deleteTransaction.run(tx.transfer_peer_id, userId);
      deleteTransaction.run(id, userId);
    })();

    res.json({ ok: true });
  });

  return router;
}
