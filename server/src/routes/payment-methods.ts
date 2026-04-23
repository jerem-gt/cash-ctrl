import { Router } from 'express';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware.js';

const schema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().max(10).default(''),
});

export function createPaymentMethodsRouter(db: Database.Database): Router {
  const getAll = db.prepare<[], { id: number; name: string; icon: string; created_at: string; tx_count: number }>(`
    SELECT pm.*, COUNT(t.id) as tx_count
    FROM payment_methods pm
    LEFT JOIN transactions t ON t.payment_method_id = pm.id
    GROUP BY pm.id
    ORDER BY pm.created_at
  `);
  const getById  = db.prepare<[number], { id: number; name: string; icon: string; created_at: string }>('SELECT * FROM payment_methods WHERE id = ?');
  const getTxCount = db.prepare<[number], { n: number }>('SELECT COUNT(*) as n FROM transactions WHERE payment_method_id = ?');
  const insertPm = db.prepare<[string, string]>('INSERT INTO payment_methods (name, icon) VALUES (?, ?)');
  const updatePm = db.prepare<[string, string, number]>('UPDATE payment_methods SET name = ?, icon = ? WHERE id = ?');
  const deletePm = db.prepare<[number]>('DELETE FROM payment_methods WHERE id = ?');

  const router = Router();
  router.use(requireAuth);

  router.get('/', (_req, res) => {
    res.json(getAll.all());
  });

  router.post('/', (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    const result = insertPm.run(parsed.data.name.trim(), parsed.data.icon);
    res.status(201).json(getById.get(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!getById.get(id)) { res.status(404).json({ error: 'Payment method not found' }); return; }
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    updatePm.run(parsed.data.name.trim(), parsed.data.icon, id);
    res.json(getById.get(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!getById.get(id)) { res.status(404).json({ error: 'Payment method not found' }); return; }
    const { n } = getTxCount.get(id)!;
    if (n > 0) {
      res.status(409).json({ error: `Ce moyen de paiement est utilisé par ${n} transaction(s) et ne peut pas être supprimé.` });
      return;
    }
    deletePm.run(id);
    res.json({ ok: true });
  });

  return router;
}
