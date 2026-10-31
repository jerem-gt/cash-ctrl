import type { Database } from 'better-sqlite3';
import { type Response, Router } from 'express';
import { z } from 'zod';

import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { assertFound, parseIdParam } from '../../lib/routeHelpers.js';
import { currentUserId, requireAuth } from '../../middleware.js';
import { createCategoriesRepo } from '../categories/categories.repo.js';
import { createTransactionsRepo } from '../transactions/transactions.repo.js';
import { createSubcategoriesRepo } from './subcategories.repo.js';

export const createSubcategorySchema = z.object({
  category_id: z.number().int().positive(),
  name: z.string().min(1).max(50),
});

export const updateSubcategorySchema = z.object({
  name: z.string().min(1).max(50),
});

export function createSubcategoriesRouter(db: Database): Router {
  const txRepo = createTransactionsRepo(db);
  const router = Router();
  router.use(requireAuth);

  const getRepo = (res: Response) => createSubcategoriesRepo(db, currentUserId(res));
  const getCatsRepo = (res: Response) => createCategoriesRepo(db, currentUserId(res));

  router.get('/', (_req, res) => {
    res.json(getRepo(res).getAll());
  });

  router.post('/', (req, res) => {
    const data = createSubcategorySchema.parse(req.body);
    if (!getCatsRepo(res).getById(data.category_id)) {
      throw new NotFoundError('category.not_found');
    }
    const repo = getRepo(res);
    const result = repo.create({
      category_id: data.category_id,
      name: data.name.trim(),
    });
    res.status(201).json(repo.getById(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = parseIdParam(req);
    const repo = getRepo(res);
    assertFound(repo, id, 'subcategory.not_found');
    const data = updateSubcategorySchema.parse(req.body);
    repo.update(id, data.name.trim());
    res.json(repo.getById(id));
  });

  router.delete('/:id', (req, res) => {
    const id = parseIdParam(req);
    const repo = getRepo(res);
    assertFound(repo, id, 'subcategory.not_found');
    const n = txRepo.getCountBySubcategoryId(id);
    if (n > 0) {
      throw new ConflictError('subcategory.in_use', { count: n });
    }
    repo.delete(id);
    res.status(204).end();
  });

  return router;
}
