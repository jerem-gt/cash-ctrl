import { Router } from 'express';
import { z } from 'zod';
import { db, queries } from '../db.js';
import { requireAuth } from '../middleware.js';

export const accountsRouter = Router();
accountsRouter.use(requireAuth);

const accountSchema = z.object({
  name: z.string().min(1).max(100),
  bank: z.string().max(100).default(''),
  type: z.string().min(1).max(50),
  initial_balance: z.number().default(0),
});

accountsRouter.get('/', (req, res) => {
  const accounts = queries.getAccounts.all(req.session.userId!);
  res.json(accounts);
});

accountsRouter.post('/', (req, res) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { name, bank, type, initial_balance } = parsed.data;
  const result = queries.insertAccount.run(req.session.userId!, name.trim(), bank.trim(), type, initial_balance);
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(account);
});

accountsRouter.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const existing = queries.getAccountById.get(id, req.session.userId!);
  if (!existing) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { name, bank, type, initial_balance } = parsed.data;
  queries.updateAccount.run(name.trim(), bank.trim(), type, initial_balance, id, req.session.userId!);
  const account = queries.getAccountById.get(id, req.session.userId!);
  res.json(account);
});

accountsRouter.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const account = queries.getAccountById.get(id, req.session.userId!);
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  queries.deleteAccount.run(id, req.session.userId!);
  res.json({ ok: true });
});
