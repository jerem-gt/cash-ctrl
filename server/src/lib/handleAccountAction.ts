import type { Request, Response } from 'express';
import { z } from 'zod';

import { sessionUserId } from '../middleware';

type Handler<T> = (ctx: { userId: number; data: T }, req: Request, res: Response) => void;

export function handleAccountAction<T>(
  req: Request<{ accountId: string }>,
  res: Response,
  belongsToUser: (accountId: number, userId: number) => boolean,
  isValidType: (accountId: number) => boolean,
  typeError: string,
  schema: z.ZodType<T>,
  handler: Handler<T>,
) {
  const accountId = Number.parseInt(req.params.accountId, 10);

  if (Number.isNaN(accountId)) {
    return res.status(400).json({ error: 'accountId invalide' });
  }

  const userId = sessionUserId(req);

  if (!belongsToUser(accountId, userId)) {
    return res.status(403).json({ error: 'Compte introuvable' });
  }

  if (!isValidType(accountId)) {
    return res.status(400).json({ error: typeError });
  }

  const parsed = schema.safeParse({ ...req.body, account_id: accountId });

  if (!parsed.success) {
    return res.status(400).json({ error: z.treeifyError(parsed.error) });
  }

  try {
    handler({ userId, data: parsed.data }, req, res);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}
