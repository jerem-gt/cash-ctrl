import type { Database } from 'better-sqlite3';
import { Request, Router } from 'express';
import { z } from 'zod';

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
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    if (!getCatsRepo(req).getById(parsed.data.category_id)) {
      res.status(404).json({ error: 'Catégorie introuvable' });
      return;
    }
    const repo = getRepo(req);
    const result = repo.create({
      category_id: parsed.data.category_id,
      name: parsed.data.name.trim(),
    });
    res.status(201).json(repo.getById(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const repo = getRepo(req);
    if (!repo.getById(id)) {
      res.status(404).json({ error: 'Sous-catégorie introuvable' });
      return;
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    repo.update(id, parsed.data.name.trim());
    res.json(repo.getById(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const repo = getRepo(req);
    if (!repo.getById(id)) {
      res.status(404).json({ error: 'Sous-catégorie introuvable' });
      return;
    }
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
