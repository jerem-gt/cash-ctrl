import { Router } from 'express';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import type { Account } from '../db.js';
import { requireAuth } from '../middleware.js';

export function createAccountsRouter(db: Database.Database): Router {
  const getAccounts    = db.prepare<[number], Account>('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at');
  const getAccountById = db.prepare<[number, number], Account>('SELECT * FROM accounts WHERE id = ? AND user_id = ?');
  const insertAccount  = db.prepare<[number, string, string, string, number]>(
    'INSERT INTO accounts (user_id, name, bank, type, initial_balance) VALUES (?, ?, ?, ?, ?)',
  );
  const updateAccount  = db.prepare<[string, string, string, number, number, number]>(
    'UPDATE accounts SET name = ?, bank = ?, type = ?, initial_balance = ? WHERE id = ? AND user_id = ?',
  );
  const deleteAccount  = db.prepare<[number, number]>('DELETE FROM accounts WHERE id = ? AND user_id = ?');

  const accountSchema = z.object({
    name:            z.string().min(1).max(100),
    bank:            z.string().min(1).max(100),
    type:            z.string().min(1).max(50),
    initial_balance: z.coerce.number().default(0),
  });

  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    res.json(getAccounts.all(req.session.userId!));
  });

  router.post('/', (req, res) => {
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    const { name, bank, type, initial_balance } = parsed.data;
    const result = insertAccount.run(req.session.userId!, name.trim(), bank.trim(), type, initial_balance);
    res.status(201).json(getAccountById.get(Number(result.lastInsertRowid), req.session.userId!));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!getAccountById.get(id, req.session.userId!)) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    const { name, bank, type, initial_balance } = parsed.data;
    updateAccount.run(name.trim(), bank.trim(), type, initial_balance, id, req.session.userId!);
    res.json(getAccountById.get(id, req.session.userId!));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!getAccountById.get(id, req.session.userId!)) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    deleteAccount.run(id, req.session.userId!);
    res.json({ ok: true });
  });

  return router;
}
