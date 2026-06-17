import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { parseBody, parseNumberParam, sendError } from '../../lib/routeHelpers';
import { requireAuth, sessionUserId } from '../../middleware';
import { createCategorizationRulesRepo } from './categorization-rules.repo';

const ruleSchema = z.object({
  pattern: z.string().min(1).max(200),
  subcategory_id: z.number().int().positive(),
});

const matchQuerySchema = z.object({
  description: z.string().min(1),
});

export function createCategorizationRulesRouter(db: Database): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const repo = createCategorizationRulesRepo(db, sessionUserId(req));
    res.json(repo.getAll());
  });

  router.get('/match', (req, res) => {
    const parsed = matchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.json(null);
      return;
    }
    const repo = createCategorizationRulesRepo(db, sessionUserId(req));
    res.json(repo.match(parsed.data.description) ?? null);
  });

  router.delete('/', (req, res) => {
    const repo = createCategorizationRulesRepo(db, sessionUserId(req));
    const deleted = repo.deleteAll();
    res.json({ deleted });
  });

  router.post('/init-from-history', (req, res) => {
    const repo = createCategorizationRulesRepo(db, sessionUserId(req));
    const inserted = repo.initFromHistory();
    res.status(201).json({ inserted });
  });

  router.post('/', (req, res) => {
    const data = parseBody(res, ruleSchema, req.body);
    if (!data) return;
    const repo = createCategorizationRulesRepo(db, sessionUserId(req));
    const rule = repo.create(data);
    res.status(201).json(rule);
  });

  router.put('/:id', (req, res) => {
    const id = parseNumberParam(req, res);
    if (id === null) return;
    const data = parseBody(res, ruleSchema, req.body);
    if (!data) return;
    const repo = createCategorizationRulesRepo(db, sessionUserId(req));
    const rule = repo.update(id, data);
    if (!rule) {
      sendError(res, 404, 'categorization_rule.not_found');
      return;
    }
    res.json(rule);
  });

  router.delete('/:id', (req, res) => {
    const id = parseNumberParam(req, res);
    if (id === null) return;
    const repo = createCategorizationRulesRepo(db, sessionUserId(req));
    if (!repo.delete(id)) {
      sendError(res, 404, 'categorization_rule.not_found');
      return;
    }
    res.json({ ok: true });
  });

  return router;
}
