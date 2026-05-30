import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { createNamedIconEntityRouter } from '../../lib/namedIconEntityRouter';
import { createTransactionsRepo } from '../transactions/transactions.repo';
import { createPaymentMethodsRepo } from './payment-methods.repo';

const schema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().max(10).default(''),
});

export function createPaymentMethodsRouter(db: Database): Router {
  const txRepo = createTransactionsRepo(db);
  return createNamedIconEntityRouter(db, {
    schema,
    repoFactory: createPaymentMethodsRepo,
    notFoundMsg: 'Payment method not found',
    countUsage: (id) => txRepo.getCountByPaymentMethodId(id),
    usageConflictMsg: (n) =>
      `Ce moyen de paiement est utilisé par ${n} transaction(s) et ne peut pas être supprimé.`,
  });
}
