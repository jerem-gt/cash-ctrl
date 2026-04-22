import { Router } from 'express';
import { z } from 'zod';
import { db, queries } from '../db.js';
import { requireAuth } from '../middleware.js';
import { generateScheduledTransactions } from '../lib/generateScheduled.js';

export const transactionsRouter = Router();
transactionsRouter.use(requireAuth);

const transactionSchema = z.object({
  account_id: z.number().int().positive(),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive(),
  description: z.string().min(1).max(200),
  category: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payment_method: z.string().min(1).max(100),
  notes: z.string().max(1000).nullable().default(null),
  validated: z.boolean().default(false),
});

const transferUpdateSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const querySchema = z.object({
  account_id: z.coerce.number().int().optional(),
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().optional(),
});

transactionsRouter.get('/', (req, res) => {
  generateScheduledTransactions(req.session.userId!);

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: z.treeifyError(parsed.error) });
    return;
  }

  const { account_id, type, category } = parsed.data;

  let query = `
    SELECT t.*, a.name as account_name
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE t.user_id = ?
  `;
  const params: (number | string)[] = [req.session.userId!];

  if (account_id) { query += ' AND t.account_id = ?'; params.push(account_id); }
  if (type)       { query += ' AND t.type = ?';       params.push(type); }
  if (category)   { query += ' AND t.category = ?';   params.push(category); }

  query += ' ORDER BY t.date DESC, t.created_at DESC';

  res.json(db.prepare(query).all(...params));
});

transactionsRouter.post('/', (req, res) => {
  const parsed = transactionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: z.treeifyError(parsed.error) });
    return;
  }

  const { account_id, type, amount, description, category, date, payment_method, notes } = parsed.data;

  const account = queries.getAccountById.get(account_id, req.session.userId!);
  if (!account) {
    res.status(403).json({ error: 'Account not found or does not belong to user' });
    return;
  }

  const result = queries.insertTransaction.run(
    req.session.userId!, account_id, type, amount, description.trim(), category, date, payment_method, notes
  );

  const tx = db.prepare(`
    SELECT t.*, a.name as account_name
    FROM transactions t JOIN accounts a ON t.account_id = a.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(tx);
});

transactionsRouter.put('/:id', (req, res) => {
  const id = Number.parseInt(req.params.id);
  const userId = req.session.userId!;

  const tx = queries.getTransactionById.get(id, userId);
  if (!tx) { res.status(404).json({ error: 'Transaction not found' }); return; }

  if (tx.transfer_peer_id) {
    const parsed = transferUpdateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    const { amount, description, date } = parsed.data;
    const updateShared = db.prepare(
      'UPDATE transactions SET amount = ?, description = ?, date = ? WHERE id = ? AND user_id = ?'
    );
    db.transaction(() => {
      updateShared.run(amount, description.trim(), date, id, userId);
      updateShared.run(amount, description.trim(), date, tx.transfer_peer_id, userId);
    })();
  } else {
    const parsed = transactionSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    const { account_id, type, amount, description, category, date, payment_method, notes, validated } = parsed.data;
    const account = queries.getAccountById.get(account_id, userId);
    if (!account) { res.status(403).json({ error: 'Account not found or does not belong to user' }); return; }
    queries.updateTransaction.run(account_id, type, amount, description.trim(), category, date, payment_method, notes, validated ? 1 : 0, id, userId);
  }

  const updated = db.prepare(`
    SELECT t.*, a.name as account_name
    FROM transactions t JOIN accounts a ON t.account_id = a.id
    WHERE t.id = ?
  `).get(id);

  res.json(updated);
});

transactionsRouter.patch('/:id/validate', (req, res) => {
  const id = Number.parseInt(req.params.id);
  const userId = req.session.userId!;
  const parsed = z.object({ validated: z.boolean() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

  const tx = queries.getTransactionById.get(id, userId);
  if (!tx) { res.status(404).json({ error: 'Transaction not found' }); return; }

  queries.setValidated.run(parsed.data.validated ? 1 : 0, id, userId);

  const updated = db.prepare(`
    SELECT t.*, a.name as account_name
    FROM transactions t JOIN accounts a ON t.account_id = a.id
    WHERE t.id = ?
  `).get(id);

  res.json(updated);
});

transactionsRouter.delete('/:id', (req, res) => {
  const id = Number.parseInt(req.params.id);
  const userId = req.session.userId!;
  const tx = queries.getTransactionById.get(id, userId);
  if (!tx) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }

  db.transaction(() => {
    if (tx.transfer_peer_id) {
      queries.deleteTransaction.run(tx.transfer_peer_id, userId);
    }
    queries.deleteTransaction.run(id, userId);
  })();

  res.json({ ok: true });
});
