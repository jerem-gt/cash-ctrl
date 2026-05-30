import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

import { sessionUserId } from '../middleware';

/**
 * Parse un paramètre de route numérique (radix 10). Répond 400 et renvoie null
 * si la valeur n'est pas un entier valide. À utiliser avec `if (value === null) return;`.
 */
export function parseNumberParam(req: Request, res: Response, paramName = 'id'): number | null {
  const value = Number.parseInt(req.params[paramName] as string, 10);
  if (Number.isNaN(value)) {
    res.status(400).json({ error: `Paramètre ${paramName} invalide` });
    return null;
  }
  return value;
}

export function makeCheckAccount(
  belongsToUser: (accountId: number, userId: number) => boolean,
): RequestHandler {
  return (req, res, next) => {
    const accountId = Number.parseInt(req.params.accountId as string, 10);
    const userId = sessionUserId(req);
    if (!belongsToUser(accountId, userId)) {
      res.status(403).json({ error: 'Compte introuvable' });
      return;
    }
    res.locals.accountId = accountId;
    res.locals.userId = userId;
    next();
  };
}

export function requireById<T>(
  res: Response,
  repo: { getById: (id: number) => T | null | undefined },
  id: number,
  notFoundMsg: string,
): boolean {
  if (!repo.getById(id)) {
    res.status(404).json({ error: notFoundMsg });
    return false;
  }
  return true;
}

export function parseBody<T>(res: Response, schema: z.ZodType<T>, body: unknown): T | null {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: z.treeifyError(parsed.error) });
    return null;
  }
  return parsed.data;
}
