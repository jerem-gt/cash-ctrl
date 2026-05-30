import type { Database } from 'better-sqlite3';
import { Request, Router } from 'express';
import { z } from 'zod';

import { parseBody, parseNumberParam, requireById } from '../../lib/routeHelpers';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createCategoriesRepo } from '../categories/categories.repo';
import { createTransactionsRepo } from '../transactions/transactions.repo';
import { createSubcategoriesRepo } from './subcategories.repo';

const createSchema = z.object({
  category_id: z.number().int().positive(),
  name: z.string().min(1).max(50),
});

const updateSchema = z.object({
  name: z.string().min(1).max(50),
});

export function createSubcategoriesRouter(db: Database): Router {
  const txRepo = createTransactionsRepo(db);
  const router = Router();
  router.use(requireAuth);

  const getRepo = (req: Request) => createSubcategoriesRepo(db, sessionUserId(req));
  const getCatsRepo = (req: Request) => createCategoriesRepo(db, sessionUserId(req));

  router.get('/', (req, res) => {
    res.json(getRepo(req).getAll());
  });

  router.post('/', (req, res) => {
    const data = parseBody(res, createSchema, req.body);
    if (!data) return;
    if (!getCatsRepo(req).getById(data.category_id)) {
      res.status(404).json({ error: 'Catégorie introuvable' });
      return;
    }
    const repo = getRepo(req);
    const result = repo.create({
      category_id: data.category_id,
      name: data.name.trim(),
    });
    res.status(201).json(repo.getById(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const repo = getRepo(req);
    if (!requireById(res, repo, id, 'Sous-catégorie introuvable')) return;
    const data = parseBody(res, updateSchema, req.body);
    if (!data) return;
    repo.update(id, data.name.trim());
    res.json(repo.getById(id));
  });

  router.delete('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const repo = getRepo(req);
    if (!requireById(res, repo, id, 'Sous-catégorie introuvable')) return;
    const n = txRepo.getCountBySubcategoryId(id);
    if (n > 0) {
      res.status(409).json({
        error: `Cette sous-catégorie est utilisée par ${n} transaction(s) et ne peut pas être supprimée.`,
      });
      return;
    }
    repo.delete(id);
    res.json({ ok: true });
  });

  return router;
}
