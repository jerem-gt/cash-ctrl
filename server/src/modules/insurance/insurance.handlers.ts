import type { Request, Response } from 'express';
import { z } from 'zod';

import { handleAccountAction, type Handler } from '../../lib/handleAccountAction';
import { createInsuranceRepo } from './insurance.repo';
type InsuranceRepo = ReturnType<typeof createInsuranceRepo>;

export function handleInsuranceAction<T>(
  req: Request<{ accountId: string }>,
  res: Response,
  repo: InsuranceRepo,
  schema: z.ZodType<T>,
  handler: Handler<T>,
) {
  return handleAccountAction(
    req,
    res,
    (id, uid) => repo.accountBelongsToUser(id, uid),
    (id) => repo.isInsuranceAccount(id),
    "Ce compte n'est pas une enveloppe assurance",
    schema,
    handler,
  );
}
