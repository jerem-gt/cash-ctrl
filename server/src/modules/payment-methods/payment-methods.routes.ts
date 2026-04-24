import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware.js';
import { createPaymentMethodsRepo } from './payment-methods.repo';
import type { Database } from 'better-sqlite3';

const schema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().max(10).default(''),
});

export function createPaymentMethodsRouter(db: Database): Router {
  const paymentMethodsRepo = createPaymentMethodsRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (_req, res) => {
    res.json(paymentMethodsRepo.getAll());
  });

  router.post('/', (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    const result = paymentMethodsRepo.create({ name: parsed.data.name.trim(), icon: parsed.data.icon });
    res.status(201).json(paymentMethodsRepo.getById(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!paymentMethodsRepo.getById(id)) { res.status(404).json({ error: 'Payment method not found' }); return; }
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    paymentMethodsRepo.update(id, { name: parsed.data.name.trim(), icon: parsed.data.icon });
    res.json(paymentMethodsRepo.getById(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!paymentMethodsRepo.getById(id)) { res.status(404).json({ error: 'Payment method not found' }); return; }
    const n = paymentMethodsRepo.getTxCount(id);
    if (n > 0) {
      res.status(409).json({ error: `Ce moyen de paiement est utilisé par ${n} transaction(s) et ne peut pas être supprimé.` });
      return;
    }
    paymentMethodsRepo.delete(id);
    res.json({ ok: true });
  });

  return router;
}
