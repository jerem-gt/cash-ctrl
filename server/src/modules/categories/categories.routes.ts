import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { createNamedIconEntityRouter } from '../../lib/namedIconEntityRouter.js';
import { createTransactionsRepo } from '../transactions/transactions.repo.js';
import { createCategoriesRepo } from './categories.repo.js';

export const categorySchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().min(1).max(64),
});

export function createCategoriesRouter(db: Database): Router {
  const txRepo = createTransactionsRepo(db);
  return createNamedIconEntityRouter(db, {
    schema: categorySchema,
    repoFactory: createCategoriesRepo,
    notFoundCode: 'category.not_found',
    countUsage: (id) => txRepo.getCountByCategoryId(id),
    usageConflictCode: 'category.in_use',
  });
}
