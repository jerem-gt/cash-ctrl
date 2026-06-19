import type { Database } from 'better-sqlite3';
import { Request, Router } from 'express';
import { z } from 'zod';

import { ENVELOPE_TYPES } from '../../constants.js';
import { parseBody, parseNumberParam, requireById, sendError } from '../../lib/routeHelpers';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createAccountsRepo } from '../accounts/accounts.repo';
import { createAccountTypesRepo } from './account-types.repo';

export const accountTypeSchema = z.object({
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
    const data = parseBody(res, accountTypeSchema, req.body);
    if (!data) return;
    const repo = getRepo(req);
    const result = repo.create(data.name.trim(), data.envelope_type);
    res.status(201).json(repo.getById(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const repo = getRepo(req);
    if (!requireById(res, repo, id, 'account_type.not_found')) return;
    const data = parseBody(res, accountTypeSchema, req.body);
    if (!data) return;
    repo.update(id, data.name.trim(), data.envelope_type);
    res.json(repo.getById(id));
  });

  router.delete('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const repo = getRepo(req);
    if (!requireById(res, repo, id, 'account_type.not_found')) return;
    const cnt = accountsRepo.countByAccountTypeId(id);
    if (cnt > 0) {
      sendError(res, 409, 'account_type.in_use', { count: cnt });
      return;
    }
    repo.delete(id);
    res.json({ ok: true });
  });

  return router;
}
