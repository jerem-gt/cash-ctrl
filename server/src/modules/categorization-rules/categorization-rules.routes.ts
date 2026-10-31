import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { NotFoundError } from '../../lib/errors.js';
import { parseIdParam } from '../../lib/routeHelpers.js';
import { currentUserId, requireAuth } from '../../middleware.js';
import { createCategorizationRulesRepo } from './categorization-rules.repo.js';

export const ruleSchema = z.object({
  pattern: z.string().min(1).max(200),
  subcategory_id: z.number().int().positive(),
});

export const matchQuerySchema = z.object({
  description: z.string().min(1),
});

export function createCategorizationRulesRouter(db: Database): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (_req, res) => {
    const repo = createCategorizationRulesRepo(db, currentUserId(res));
    res.json(repo.getAll());
  });

  router.get('/match', (req, res) => {
    const parsed = matchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.json(null);
      return;
    }
    const repo = createCategorizationRulesRepo(db, currentUserId(res));
    res.json(repo.match(parsed.data.description) ?? null);
  });

  router.delete('/', (_req, res) => {
    const repo = createCategorizationRulesRepo(db, currentUserId(res));
    const deleted = repo.deleteAll();
    res.json({ deleted });
  });

  router.post('/init-from-history', (_req, res) => {
    const repo = createCategorizationRulesRepo(db, currentUserId(res));
    const inserted = repo.initFromHistory();
    res.status(201).json({ inserted });
  });

  router.post('/', (req, res) => {
    const data = ruleSchema.parse(req.body);
    const repo = createCategorizationRulesRepo(db, currentUserId(res));
    const rule = repo.create(data);
    res.status(201).json(rule);
  });

  router.put('/:id', (req, res) => {
    const id = parseIdParam(req);
    const data = ruleSchema.parse(req.body);
    const repo = createCategorizationRulesRepo(db, currentUserId(res));
    const rule = repo.update(id, data);
    if (!rule) {
      throw new NotFoundError('categorization_rule.not_found');
    }
    res.json(rule);
  });

  router.delete('/:id', (req, res) => {
    const id = parseIdParam(req);
    const repo = createCategorizationRulesRepo(db, currentUserId(res));
    if (!repo.delete(id)) {
      throw new NotFoundError('categorization_rule.not_found');
    }
    res.status(204).end();
  });

  return router;
}
