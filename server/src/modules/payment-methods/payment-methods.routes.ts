import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { createNamedIconEntityRouter } from '../../lib/namedIconEntityRouter.js';
import { createTransactionsRepo } from '../transactions/transactions.repo.js';
import { createPaymentMethodsRepo } from './payment-methods.repo.js';

export const paymentMethodSchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().max(10).default(''),
});

export function createPaymentMethodsRouter(db: Database): Router {
  const txRepo = createTransactionsRepo(db);
  return createNamedIconEntityRouter(db, {
    schema: paymentMethodSchema,
    repoFactory: createPaymentMethodsRepo,
    notFoundCode: 'payment_method.not_found',
    countUsage: (id) => txRepo.getCountByPaymentMethodId(id),
    usageConflictCode: 'payment_method.in_use',
  });
}
