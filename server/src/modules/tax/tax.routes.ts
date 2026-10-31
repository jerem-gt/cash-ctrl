import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import { NotFoundError } from '../../lib/errors.js';
import { parseIdParam } from '../../lib/routeHelpers.js';
import { requireAuth } from '../../middleware.js';
import { createTaxRepo } from './tax.repo.js';

export function createTaxRouter(db: Database): Router {
  const repo = createTaxRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/years', (_req, res) => {
    res.json(repo.getAvailableYears());
  });

  router.get('/:year', (req, res) => {
    const year = parseIdParam(req, 'year');
    const data = repo.getYearData(year);
    if (!data) {
      throw new NotFoundError('tax.bracket_not_found', { year });
    }
    res.json(data);
  });

  return router;
}
