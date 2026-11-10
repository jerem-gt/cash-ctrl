import { createIdParamParser } from '@jerem-gt/ctrl-shared/server/params';
import type { Database } from 'better-sqlite3';
import type { RequestHandler } from 'express';

import { currentUserId } from '../middleware.js';
import { assertOwnedAccount } from './accountHelpers.js';
import type { ErrorCode } from './errorCodes.js';
import { HttpError, NotFoundError } from './errors.js';

declare module 'express-serve-static-core' {
  interface Locals {
    accountId: number;
    userId: number;
  }
}

/** Paramètre de route entier strictement positif (`id` par défaut), sinon 400 `common.invalid_param`. */
export const parseIdParam = createIdParamParser(HttpError);

/** Compte de la route (`:accountId`, 400 s'il est mal formé) appartenant à l'utilisateur, sinon 404 `account.not_found`. */
export function makeCheckAccount(db: Database): RequestHandler {
  return (req, res, next) => {
    const accountId = parseIdParam(req, 'accountId');
    assertOwnedAccount(db, accountId, currentUserId(res));
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
