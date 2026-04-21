import { Router } from 'express';
import { z } from 'zod';
import { queries } from '../db.js';
import { requireAuth } from '../middleware.js';

export const paymentMethodsRouter = Router();
paymentMethodsRouter.use(requireAuth);

const schema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().max(10).default(''),
});

paymentMethodsRouter.get('/', (_req, res) => {
  res.json(queries.getPaymentMethods.all());
});

paymentMethodsRouter.post('/', (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
  const result = queries.insertPaymentMethod.run(parsed.data.name.trim(), parsed.data.icon);
  res.status(201).json(queries.getPaymentMethodById.get(Number(result.lastInsertRowid)));
});

paymentMethodsRouter.put('/:id', (req, res) => {
  const id = Number.parseInt(req.params.id);
  if (!queries.getPaymentMethodById.get(id)) { res.status(404).json({ error: 'Payment method not found' }); return; }
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
  queries.updatePaymentMethod.run(parsed.data.name.trim(), parsed.data.icon, id);
  res.json(queries.getPaymentMethodById.get(id));
});

paymentMethodsRouter.delete('/:id', (req, res) => {
  const id = Number.parseInt(req.params.id);
  if (!queries.getPaymentMethodById.get(id)) { res.status(404).json({ error: 'Payment method not found' }); return; }
  queries.deletePaymentMethod.run(id);
  res.json({ ok: true });
});
