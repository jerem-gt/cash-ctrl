import type { Database } from 'better-sqlite3';
import { type Response, Router } from 'express';
import { z } from 'zod';

import { ENVELOPE_TYPES } from '../../constants.js';
import { ConflictError } from '../../lib/errors.js';
import { assertFound, parseIdParam } from '../../lib/routeHelpers.js';
import { currentUserId, requireAuth } from '../../middleware.js';
import { createAccountsRepo } from '../accounts/accounts.repo.js';
import { createAccountTypesRepo } from './account-types.repo.js';

export const accountTypeSchema = z.object({
  name: z.string().min(1).max(50),
  envelope_type: z.enum(ENVELOPE_TYPES).nullable().default(null),
});

export function createAccountTypesRouter(db: Database): Router {
  const accountsRepo = createAccountsRepo(db);
  const router = Router();
  router.use(requireAuth);

  const getRepo = (res: Response) => createAccountTypesRepo(db, currentUserId(res));

  router.get('/', (_req, res) => {
    res.json(getRepo(res).getAll());
  });

  router.post('/', (req, res) => {
    const data = accountTypeSchema.parse(req.body);
    const repo = getRepo(res);
    const result = repo.create(data.name.trim(), data.envelope_type);
    res.status(201).json(repo.getById(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = parseIdParam(req);
    const repo = getRepo(res);
    assertFound(repo, id, 'account_type.not_found');
    const data = accountTypeSchema.parse(req.body);
    repo.update(id, data.name.trim(), data.envelope_type);
    res.json(repo.getById(id));
  });

  router.delete('/:id', (req, res) => {
    const id = parseIdParam(req);
    const repo = getRepo(res);
    assertFound(repo, id, 'account_type.not_found');
    const cnt = accountsRepo.countByAccountTypeId(id);
    if (cnt > 0) {
      throw new ConflictError('account_type.in_use', { count: cnt });
    }
    repo.delete(id);
    res.json({ ok: true });
  });

  return router;
}
