import { Router } from 'express';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import type { Account } from '../db.js';
import { requireAuth } from '../middleware.js';

const ACCOUNT_WITH_JOINS = `
  SELECT a.id, a.user_id, a.name, a.bank_id, a.account_type_id, a.initial_balance, a.created_at,
         COALESCE(b.name, '') as bank,
         COALESCE(at.name, '') as type
  FROM accounts a
  LEFT JOIN banks b ON a.bank_id = b.id
  LEFT JOIN account_types at ON a.account_type_id = at.id
`;

export function createAccountsRouter(db: Database.Database): Router {
  const getAccounts = db.prepare<[number], Account>(
    `${ACCOUNT_WITH_JOINS} WHERE a.user_id = ? ORDER BY a.created_at`,
  );
  const getAccountById = db.prepare<[number, number], Account>(
    `${ACCOUNT_WITH_JOINS} WHERE a.id = ? AND a.user_id = ?`,
  );
  const insertAccount = db.prepare<[number, string, number | null, number | null, number]>(
    'INSERT INTO accounts (user_id, name, bank_id, account_type_id, initial_balance) VALUES (?, ?, ?, ?, ?)',
  );
  const updateAccount = db.prepare<[string, number | null, number | null, number, number, number]>(
    'UPDATE accounts SET name = ?, bank_id = ?, account_type_id = ?, initial_balance = ? WHERE id = ? AND user_id = ?',
  );
  const deleteAccount = db.prepare<[number, number]>('DELETE FROM accounts WHERE id = ? AND user_id = ?');

  const accountSchema = z.object({
    name:            z.string().min(1).max(100),
    bank_id:         z.number().int().positive().nullable().optional(),
    account_type_id: z.number().int().positive().nullable().optional(),
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
    const { name, bank_id, account_type_id, initial_balance } = parsed.data;
    const result = insertAccount.run(req.session.userId!, name.trim(), bank_id ?? null, account_type_id ?? null, initial_balance);
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
    const { name, bank_id, account_type_id, initial_balance } = parsed.data;
    updateAccount.run(name.trim(), bank_id ?? null, account_type_id ?? null, initial_balance, id, req.session.userId!);
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
