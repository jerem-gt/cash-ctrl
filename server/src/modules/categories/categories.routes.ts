import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../../middleware.js';
import { createCategoriesRepo } from './categories.repo';

const categorySchema = z.object({
  name:  z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#9E9A92'),
});

export function createCategoriesRouter(db: Database): Router {
  const categoriesRepo = createCategoriesRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (_req, res) => {
    res.json(categoriesRepo.getAll());
  });

  router.post('/', (req, res) => {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    const result = categoriesRepo.create({ name: parsed.data.name.trim(), color: parsed.data.color });
    res.status(201).json(categoriesRepo.getById(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!categoriesRepo.getById(id)) { res.status(404).json({ error: 'Category not found' }); return; }
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    categoriesRepo.update(id, { name: parsed.data.name.trim(), color: parsed.data.color });
    res.json(categoriesRepo.getById(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!categoriesRepo.getById(id)) { res.status(404).json({ error: 'Category not found' }); return; }
    const n = categoriesRepo.getTxCount(id);
    if (n > 0) {
      res.status(409).json({ error: `Cette catégorie est utilisée par ${n} transaction(s) et ne peut pas être supprimée.` });
      return;
    }
    categoriesRepo.delete(id);
    res.json({ ok: true });
  });

  return router;
}
