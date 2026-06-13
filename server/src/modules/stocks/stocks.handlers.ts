import type { Request, Response } from 'express';
import { z } from 'zod';

import { handleAccountAction, type Handler } from '../../lib/handleAccountAction';
import { createStocksRepo } from './stocks.repo';
type StocksRepo = ReturnType<typeof createStocksRepo>;

export function handleStockAction<T>(
  req: Request<{ accountId: string }>,
  res: Response,
  repo: StocksRepo,
  schema: z.ZodType<T>,
  handler: Handler<T>,
) {
  return handleAccountAction(
    req,
    res,
    (id, uid) => repo.accountBelongsToUser(id, uid),
    (id) => repo.isInvestmentAccount(id),
    'stock.account_not_investment',
    schema,
    handler,
  );
}
