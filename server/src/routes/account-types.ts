import { Router } from 'express';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import type { AccountTypeRecord } from '../db.js';
import { requireAuth } from '../middleware.js';

const schema = z.object({ name: z.string().min(1).max(50) });

export function createAccountTypesRouter(db: Database.Database): Router {
  const getAccountTypes = db.prepare<[], AccountTypeRecord & { acc_count: number }>(
    `SELECT at.*, COUNT(a.id) as acc_count FROM account_types at LEFT JOIN accounts a ON a.account_type_id = at.id GROUP BY at.id ORDER BY at.created_at`,
  );
  const getAccountTypeById = db.prepare<[number], AccountTypeRecord>('SELECT * FROM account_types WHERE id = ?');
  const insertAccountType = db.prepare<[string]>('INSERT INTO account_types (name) VALUES (?)');
  const updateAccountType = db.prepare<[string, number]>('UPDATE account_types SET name = ? WHERE id = ?');
  const deleteAccountType = db.prepare<[number]>('DELETE FROM account_types WHERE id = ?');

  const router = Router();
  router.use(requireAuth);

  router.get('/', (_req, res) => {
    res.json(getAccountTypes.all());
  });

  router.post('/', (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    const result = insertAccountType.run(parsed.data.name.trim());
    res.status(201).json(getAccountTypeById.get(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!getAccountTypeById.get(id)) { res.status(404).json({ error: 'Account type not found' }); return; }
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    updateAccountType.run(parsed.data.name.trim(), id);
    res.json(getAccountTypeById.get(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!getAccountTypeById.get(id)) { res.status(404).json({ error: 'Account type not found' }); return; }
    const usage = db.prepare<[number], { cnt: number }>('SELECT COUNT(*) as cnt FROM accounts WHERE account_type_id = ?').get(id);
    if (usage && usage.cnt > 0) {
      res.status(409).json({ error: `Ce type est utilisé par ${usage.cnt} compte(s).` });
      return;
    }
    deleteAccountType.run(id);
    res.json({ ok: true });
  });

  return router;
}
