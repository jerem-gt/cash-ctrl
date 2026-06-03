import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import { parseNumberParam, sendError } from '../../lib/routeHelpers.js';
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
    const year = parseNumberParam(req, res, 'year');
    if (year === null) return;
    const data = repo.getYearData(year);
    if (!data) {
      sendError(res, 404, 'tax.bracket_not_found', { year });
      return;
    }
    res.json(data);
  });

  return router;
}
