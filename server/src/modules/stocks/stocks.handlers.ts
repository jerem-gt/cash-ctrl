import type { Request, Response } from 'express';
import { z } from 'zod';

import { sessionUserId } from '../../middleware';
import { createStocksRepo } from './stocks.repo';

type Handler<T> = (
  ctx: {
    userId: number;
    data: T;
  },
  req: Request,
  res: Response,
) => void;

type StocksRepo = ReturnType<typeof createStocksRepo>;

export function handleStockAction<T>(
  req: Request<{ accountId: string }>,
  res: Response,
  repo: StocksRepo,
  schema: z.ZodType<T>,
  handler: Handler<T>,
) {
  const accountId = Number.parseInt(req.params.accountId, 10);

  if (Number.isNaN(accountId)) {
    return res.status(400).json({ error: 'accountId invalide' });
  }

  const userId = sessionUserId(req);

  if (!repo.accountBelongsToUser(accountId, userId)) {
    return res.status(403).json({ error: 'Compte introuvable' });
  }

  if (!repo.isInvestmentAccount(accountId)) {
    return res.status(400).json({
      error: "Ce compte n'est pas un compte d'investissement",
    });
  }

  const parsed = schema.safeParse({
    ...req.body,
    account_id: accountId,
  });

  if (!parsed.success) {
    return res.status(400).json({
      error: z.treeifyError(parsed.error),
    });
  }

  try {
    handler({ userId, data: parsed.data }, req, res);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}
