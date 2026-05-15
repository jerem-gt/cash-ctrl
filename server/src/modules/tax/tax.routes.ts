import type { Database } from 'better-sqlite3';
import { Router } from 'express';

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
    const year = Number.parseInt(req.params.year);
    if (Number.isNaN(year)) {
      res.status(400).json({ error: 'Année invalide' });
      return;
    }
    const data = repo.getYearData(year);
    if (!data) {
      res.status(404).json({ error: `Barème ${year} introuvable` });
      return;
    }
    res.json(data);
  });

  return router;
}
