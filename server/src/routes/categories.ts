import { Router } from 'express';
import { z } from 'zod';
import { queries } from '../db.js';
import { requireAuth } from '../middleware.js';

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

const categorySchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#9E9A92'),
});

categoriesRouter.get('/', (_req, res) => {
  res.json(queries.getCategories.all());
});

categoriesRouter.post('/', (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

  const { name, color } = parsed.data;
  const result = queries.insertCategory.run(name.trim(), color);
  res.status(201).json(queries.getCategoryById.get(Number(result.lastInsertRowid)));
});

categoriesRouter.put('/:id', (req, res) => {
  const id = Number.parseInt(req.params.id);
  if (!queries.getCategoryById.get(id)) { res.status(404).json({ error: 'Category not found' }); return; }

  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

  const { name, color } = parsed.data;
  queries.updateCategory.run(name.trim(), color, id);
  res.json(queries.getCategoryById.get(id));
});

categoriesRouter.delete('/:id', (req, res) => {
  const id = Number.parseInt(req.params.id);
  if (!queries.getCategoryById.get(id)) { res.status(404).json({ error: 'Category not found' }); return; }
  queries.deleteCategory.run(id);
  res.json({ ok: true });
});
