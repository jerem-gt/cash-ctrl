import type { Request, Response } from 'express';
import { z } from 'zod';

import { sessionUserId } from '../../middleware';
import { createInsuranceRepo } from './insurance.repo';

type Handler<T> = (ctx: { userId: number; data: T }, req: Request, res: Response) => void;
type InsuranceRepo = ReturnType<typeof createInsuranceRepo>;

export function handleInsuranceAction<T>(
  req: Request<{ accountId: string }>,
  res: Response,
  repo: InsuranceRepo,
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

  if (!repo.isInsuranceAccount(accountId)) {
    return res.status(400).json({ error: "Ce compte n'est pas une enveloppe assurance" });
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
