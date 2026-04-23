import { Router } from 'express';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import type { PaymentMethodRecord } from '../db.js';
import { requireAuth } from '../middleware.js';

const schema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().max(10).default(''),
});

export function createPaymentMethodsRouter(db: Database.Database): Router {
  const getPaymentMethods   = db.prepare<[], PaymentMethodRecord>('SELECT * FROM payment_methods ORDER BY created_at');
  const getPaymentMethodById = db.prepare<[number], PaymentMethodRecord>('SELECT * FROM payment_methods WHERE id = ?');
  const insertPaymentMethod = db.prepare<[string, string]>('INSERT INTO payment_methods (name, icon) VALUES (?, ?)');
  const updatePaymentMethod = db.prepare<[string, string, number]>('UPDATE payment_methods SET name = ?, icon = ? WHERE id = ?');
  const deletePaymentMethod = db.prepare<[number]>('DELETE FROM payment_methods WHERE id = ?');

  const router = Router();
  router.use(requireAuth);

  router.get('/', (_req, res) => {
    res.json(getPaymentMethods.all());
  });

  router.post('/', (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    const result = insertPaymentMethod.run(parsed.data.name.trim(), parsed.data.icon);
    res.status(201).json(getPaymentMethodById.get(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!getPaymentMethodById.get(id)) { res.status(404).json({ error: 'Payment method not found' }); return; }
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    updatePaymentMethod.run(parsed.data.name.trim(), parsed.data.icon, id);
    res.json(getPaymentMethodById.get(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!getPaymentMethodById.get(id)) { res.status(404).json({ error: 'Payment method not found' }); return; }
    deletePaymentMethod.run(id);
    res.json({ ok: true });
  });

  return router;
}
