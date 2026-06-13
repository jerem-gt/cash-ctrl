import type { Request, Response } from 'express';
import { z } from 'zod';

import { sessionUserId } from '../middleware';
import { type ErrorCode } from './errorCodes';
import { handleHttpErrors, sendError, zodToApiError } from './routeHelpers';

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
    return sendError(res, 400, 'common.invalid_param', { param: 'accountId' });
  }

  const userId = sessionUserId(req);

  if (!belongsToUser(accountId, userId)) {
    return sendError(res, 403, 'account.not_found');
  }

  if (!isValidType(accountId)) {
    return sendError(res, 400, typeErrorCode);
  }

  const parsed = schema.safeParse({ ...req.body, account_id: accountId });

  if (!parsed.success) {
    return res.status(400).json({ error: zodToApiError(parsed.error) });
  }

  handleHttpErrors(res, () => {
    handler({ userId, data: parsed.data }, req, res);
  });
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
