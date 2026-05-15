import type { Database } from 'better-sqlite3';
import { Request, Router } from 'express';
import { z } from 'zod';

import { parseBody } from '../../lib/routeHelpers';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createTransactionsRepo } from '../transactions/transactions.repo';
import { createPaymentMethodsRepo } from './payment-methods.repo';

const schema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().max(10).default(''),
});

export function createPaymentMethodsRouter(db: Database): Router {
  const txRepo = createTransactionsRepo(db);
  const router = Router();
  router.use(requireAuth);

  const getRepo = (req: Request) => createPaymentMethodsRepo(db, sessionUserId(req));

  router.get('/', (req, res) => {
    res.json(getRepo(req).getAll());
  });

  router.post('/', (req, res) => {
    const data = parseBody(res, schema, req.body);
    if (!data) return;
    const repo = getRepo(req);
    const result = repo.create({ name: data.name.trim(), icon: data.icon });
    res.status(201).json(repo.getById(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const repo = getRepo(req);
    if (!repo.getById(id)) {
      res.status(404).json({ error: 'Payment method not found' });
      return;
    }
    const data = parseBody(res, schema, req.body);
    if (!data) return;
    repo.update(id, { name: data.name.trim(), icon: data.icon });
    res.json(repo.getById(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const repo = getRepo(req);
    if (!repo.getById(id)) {
      res.status(404).json({ error: 'Payment method not found' });
      return;
    }
    const n = txRepo.getCountByPaymentMethodId(id);
    if (n > 0) {
      res.status(409).json({
        error: `Ce moyen de paiement est utilisé par ${n} transaction(s) et ne peut pas être supprimé.`,
      });
      return;
    }
    repo.delete(id);
    res.json({ ok: true });
  });

  return router;
}
