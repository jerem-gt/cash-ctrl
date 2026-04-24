import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware.js';
import { createAccountTypesRepo } from './account-types.repo';
import type { Database } from 'better-sqlite3';

const schema = z.object({ name: z.string().min(1).max(50) });

export function createAccountTypesRouter(db: Database): Router {
  const accountTypesRepo = createAccountTypesRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (_req, res) => {
    res.json(accountTypesRepo.getAll());
  });

  router.post('/', (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    const result = accountTypesRepo.create(parsed.data.name.trim());
    res.status(201).json(accountTypesRepo.getById(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!accountTypesRepo.getById(id)) { res.status(404).json({ error: 'Account type not found' }); return; }
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    accountTypesRepo.update(id, parsed.data.name.trim());
    res.json(accountTypesRepo.getById(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!accountTypesRepo.getById(id)) { res.status(404).json({ error: 'Account type not found' }); return; }
    const cnt = accountTypesRepo.getAccountCount(id);
    if (cnt > 0) {
      res.status(409).json({ error: `Ce type est utilisé par ${cnt} compte(s).` });
      return;
    }
    accountTypesRepo.delete(id);
    res.json({ ok: true });
  });

  return router;
}
