import { zodToApiError } from '@jerem-gt/ctrl-shared/server/apiErrors';
import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';

import { HttpError } from './errors.js';

declare module 'express-serve-static-core' {
  interface Locals {
    accountId: number;
    userId: number;
  }
}

import { sessionUserId } from '../middleware.js';
import { type ErrorCode, sendError } from './errorCodes.js';

// Partagés avec shelf-ctrl (ctrl-shared) : réexportés pour les routes.
export { sendError } from './errorCodes.js';
export { zodToApiError } from '@jerem-gt/ctrl-shared/server/apiErrors';

/**
 * Parse un paramètre de route numérique (radix 10). Répond 400 et renvoie null
 * si la valeur n'est pas un entier valide. À utiliser avec `if (value === null) return;`.
 */
export function parseNumberParam(req: Request, res: Response, paramName = 'id'): number | null {
  const value = Number.parseInt(req.params[paramName] as string, 10);
  if (Number.isNaN(value)) {
    sendError(res, 400, 'common.invalid_param', { param: paramName });
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
      sendError(res, 403, 'account.not_found');
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
  notFoundCode: ErrorCode,
): boolean {
  if (!repo.getById(id)) {
    sendError(res, 404, notFoundCode);
    return false;
  }
  return true;
}

export function handleHttpErrors(res: Response, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    if (err instanceof HttpError) {
      sendError(res, err.status, err.code, err.params);
      return;
    }
    // Erreur inattendue : remontée au globalErrorHandler (500 + log).
    throw err;
  }
}

export function parseBody<T>(res: Response, schema: z.ZodType<T>, body: unknown): T | null {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: zodToApiError(parsed.error) });
    return null;
  }
  return parsed.data;
}
