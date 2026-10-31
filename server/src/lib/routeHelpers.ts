import type { Request, RequestHandler } from 'express';

import { currentUserId } from '../middleware.js';
import type { ErrorCode } from './errorCodes.js';
import { BadRequestError, HttpError, NotFoundError } from './errors.js';

declare module 'express-serve-static-core' {
  interface Locals {
    accountId: number;
    userId: number;
  }
}

/**
 * Paramètre de route numérique (radix 10, `parseInt` : « 12abc » vaut 12). Lève 400
 * `common.invalid_param` si ce n'est pas un nombre.
 */
export function parseIdParam(req: Request, paramName = 'id'): number {
  const value = Number.parseInt(req.params[paramName] as string, 10);
  if (Number.isNaN(value)) {
    throw new BadRequestError('common.invalid_param', { param: paramName });
  }
  return value;
}

/** Compte de la route (`:accountId`) appartenant à l'utilisateur, sinon 403 `account.not_found`. */
export function makeCheckAccount(
  belongsToUser: (accountId: number, userId: number) => boolean,
): RequestHandler {
  return (req, res, next) => {
    const accountId = Number.parseInt(req.params.accountId as string, 10);
    const userId = currentUserId(res);
    if (!belongsToUser(accountId, userId)) {
      throw new HttpError(403, 'account.not_found');
    }
    res.locals.accountId = accountId;
    next();
  };
}

/** L'objet `id` existe dans le repo (scopé à l'utilisateur), sinon 404 avec `notFoundCode`. */
export function assertFound(
  repo: { getById: (id: number) => unknown },
  id: number,
  notFoundCode: ErrorCode,
): void {
  if (!repo.getById(id)) {
    throw new NotFoundError(notFoundCode);
  }
}
