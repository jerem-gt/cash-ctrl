import type { Database } from 'better-sqlite3';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { currentUserId } from '../middleware.js';
import { assertOwnedAccount } from './accountHelpers.js';
import { type ErrorCode } from './errorCodes.js';
import { BadRequestError } from './errors.js';

export type Handler<T> = (ctx: { userId: number; data: T }, req: Request, res: Response) => void;

export function handleAccountAction<T>(
  req: Request<{ accountId: string }>,
  res: Response,
  db: Database,
  isValidType: (accountId: number) => boolean,
  typeErrorCode: ErrorCode,
  schema: z.ZodType<T>,
  handler: Handler<T>,
) {
  const accountId = Number.parseInt(req.params.accountId, 10);
  if (Number.isNaN(accountId)) {
    throw new BadRequestError('common.invalid_param', { param: 'accountId' });
  }
  const userId = currentUserId(res);
  assertOwnedAccount(db, accountId, userId);
  if (!isValidType(accountId)) {
    throw new BadRequestError(typeErrorCode);
  }
  const data = schema.parse({ ...req.body, account_id: accountId });
  handler({ userId, data }, req, res);
}

export function createAccountActionHandler(
  db: Database,
  isValidType: (id: number) => boolean,
  typeErrorCode: ErrorCode,
) {
  return <T>(
    req: Request<{ accountId: string }>,
    res: Response,
    schema: z.ZodType<T>,
    handler: Handler<T>,
  ) => handleAccountAction(req, res, db, isValidType, typeErrorCode, schema, handler);
}
