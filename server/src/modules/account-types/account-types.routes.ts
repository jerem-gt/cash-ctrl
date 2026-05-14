import type { Database } from 'better-sqlite3';
import { Request, Router } from 'express';
import { z } from 'zod';

import { ENVELOPE_TYPES } from '../../constants.js';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createAccountsRepo } from '../accounts/accounts.repo';
import { createAccountTypesRepo } from './account-types.repo';

const schema = z.object({
  name: z.string().min(1).max(50),
  envelope_type: z.enum(ENVELOPE_TYPES).nullable().default(null),
});

export function createAccountTypesRouter(db: Database): Router {
  const accountsRepo = createAccountsRepo(db);
  const router = Router();
  router.use(requireAuth);

  const getRepo = (req: Request) => createAccountTypesRepo(db, sessionUserId(req));

  router.get('/', (req, res) => {
    res.json(getRepo(req).getAll());
  });

  router.post('/', (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    const repo = getRepo(req);
    const result = repo.create(parsed.data.name.trim(), parsed.data.envelope_type);
    res.status(201).json(repo.getById(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const repo = getRepo(req);
    if (!repo.getById(id)) {
      res.status(404).json({ error: 'Account type not found' });
      return;
    }
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    repo.update(id, parsed.data.name.trim(), parsed.data.envelope_type);
    res.json(repo.getById(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const repo = getRepo(req);
    if (!repo.getById(id)) {
      res.status(404).json({ error: 'Account type not found' });
      return;
    }
    const cnt = accountsRepo.countByAccountTypeId(id);
    if (cnt > 0) {
      res.status(409).json({ error: `Ce type est utilisé par ${cnt} compte(s).` });
      return;
    }
    repo.delete(id);
    res.json({ ok: true });
  });

  return router;
}
