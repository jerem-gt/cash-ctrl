import { Router } from 'express';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import type { Category } from '../db.js';
import { requireAuth } from '../middleware.js';

const categorySchema = z.object({
  name:  z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#9E9A92'),
});

export function createCategoriesRouter(db: Database.Database): Router {
  const getCategories   = db.prepare<[], Category>('SELECT * FROM categories ORDER BY created_at');
  const getCategoryById = db.prepare<[number], Category>('SELECT * FROM categories WHERE id = ?');
  const insertCategory  = db.prepare<[string, string]>('INSERT INTO categories (name, color) VALUES (?, ?)');
  const updateCategory  = db.prepare<[string, string, number]>('UPDATE categories SET name = ?, color = ? WHERE id = ?');
  const deleteCategory  = db.prepare<[number]>('DELETE FROM categories WHERE id = ?');

  const router = Router();
  router.use(requireAuth);

  router.get('/', (_req, res) => {
    res.json(getCategories.all());
  });

  router.post('/', (req, res) => {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    const result = insertCategory.run(parsed.data.name.trim(), parsed.data.color);
    res.status(201).json(getCategoryById.get(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!getCategoryById.get(id)) { res.status(404).json({ error: 'Category not found' }); return; }
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    updateCategory.run(parsed.data.name.trim(), parsed.data.color, id);
    res.json(getCategoryById.get(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!getCategoryById.get(id)) { res.status(404).json({ error: 'Category not found' }); return; }
    deleteCategory.run(id);
    res.json({ ok: true });
  });

  return router;
}
