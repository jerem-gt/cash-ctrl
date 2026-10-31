import type { Request, Response } from 'express';
import { z } from 'zod';

import { currentUserId } from '../middleware.js';
import { type ErrorCode } from './errorCodes.js';
import { BadRequestError, NotFoundError } from './errors.js';

export type Handler<T> = (ctx: { userId: number; data: T }, req: Request, res: Response) => void;

export function handleAccountAction<T>(
  req: Request<{ accountId: string }>,
  res: Response,
  belongsToUser: (accountId: number, userId: number) => boolean,
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
  if (!belongsToUser(accountId, userId)) {
    throw new NotFoundError('account.not_found');
  }
  if (!isValidType(accountId)) {
    throw new BadRequestError(typeErrorCode);
  }
  const data = schema.parse({ ...req.body, account_id: accountId });
  handler({ userId, data }, req, res);
}

export function createAccountActionHandler<
  TRepo extends { accountBelongsToUser: (id: number, uid: number) => boolean },
>(repo: TRepo, isValidType: (id: number) => boolean, typeErrorCode: ErrorCode) {
  return <T>(
    req: Request<{ accountId: string }>,
    res: Response,
    schema: z.ZodType<T>,
    handler: Handler<T>,
  ) =>
    handleAccountAction(
      req,
      res,
      (id, uid) => repo.accountBelongsToUser(id, uid),
      isValidType,
      typeErrorCode,
      schema,
      handler,
    );
}
