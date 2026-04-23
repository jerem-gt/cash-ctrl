import { Router } from 'express';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware.js';

const categorySchema = z.object({
  name:  z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#9E9A92'),
});

export function createCategoriesRouter(db: Database.Database): Router {
  const getAll = db.prepare<[], { id: number; name: string; color: string; created_at: string; tx_count: number }>(`
    SELECT c.*, COUNT(t.id) as tx_count
    FROM categories c
    LEFT JOIN transactions t ON t.category_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at
  `);
  const getById      = db.prepare<[number], { id: number; name: string; color: string; created_at: string }>('SELECT * FROM categories WHERE id = ?');
  const getTxCount   = db.prepare<[number], { n: number }>('SELECT COUNT(*) as n FROM transactions WHERE category_id = ?');
  const insertCat    = db.prepare<[string, string]>('INSERT INTO categories (name, color) VALUES (?, ?)');
  const updateCat    = db.prepare<[string, string, number]>('UPDATE categories SET name = ?, color = ? WHERE id = ?');
  const deleteCat    = db.prepare<[number]>('DELETE FROM categories WHERE id = ?');

  const router = Router();
  router.use(requireAuth);

  router.get('/', (_req, res) => {
    res.json(getAll.all());
  });

  router.post('/', (req, res) => {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    const result = insertCat.run(parsed.data.name.trim(), parsed.data.color);
    res.status(201).json(getById.get(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!getById.get(id)) { res.status(404).json({ error: 'Category not found' }); return; }
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    updateCat.run(parsed.data.name.trim(), parsed.data.color, id);
    res.json(getById.get(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!getById.get(id)) { res.status(404).json({ error: 'Category not found' }); return; }
    const { n } = getTxCount.get(id)!;
    if (n > 0) {
      res.status(409).json({ error: `Cette catégorie est utilisée par ${n} transaction(s) et ne peut pas être supprimée.` });
      return;
    }
    deleteCat.run(id);
    res.json({ ok: true });
  });

  return router;
}
