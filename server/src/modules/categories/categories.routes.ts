import type { Database } from 'better-sqlite3';
import { Request, Router } from 'express';
import { z } from 'zod';

import { parseBody, parseNumberParam, requireById } from '../../lib/routeHelpers';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createTransactionsRepo } from '../transactions/transactions.repo';
import { createCategoriesRepo } from './categories.repo';

const categorySchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().min(1).max(64),
});

export function createCategoriesRouter(db: Database): Router {
  const txRepo = createTransactionsRepo(db);
  const router = Router();
  router.use(requireAuth);

  const getRepo = (req: Request) => createCategoriesRepo(db, sessionUserId(req));

  router.get('/', (req, res) => {
    res.json(getRepo(req).getAll());
  });

  router.post('/', (req, res) => {
    const data = parseBody(res, categorySchema, req.body);
    if (!data) return;
    const repo = getRepo(req);
    const result = repo.create({ name: data.name.trim(), icon: data.icon });
    res.status(201).json(repo.getById(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const repo = getRepo(req);
    if (!requireById(res, repo, id, 'Category not found')) return;
    const data = parseBody(res, categorySchema, req.body);
    if (!data) return;
    repo.update(id, { name: data.name.trim(), icon: data.icon });
    res.json(repo.getById(id));
  });

  router.delete('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const repo = getRepo(req);
    if (!requireById(res, repo, id, 'Category not found')) return;
    const n = txRepo.getCountByCategoryId(id);
    if (n > 0) {
      res.status(409).json({
        error: `Cette catégorie est utilisée par ${n} transaction(s) et ne peut pas être supprimée.`,
      });
      return;
    }
    repo.delete(id);
    res.json({ ok: true });
  });

  return router;
}
