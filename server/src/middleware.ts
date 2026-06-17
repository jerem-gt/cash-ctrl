import { NextFunction, Request, Response } from 'express';

import { buildError } from './lib/errorCodes';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    username?: string;
    isAdmin?: boolean;
    pendingUserId?: number;
    pendingTotpAt?: number;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.userId) {
    next();
    return;
  }
  res.status(401).json({ error: buildError('common.unauthorized') });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.userId && req.session.isAdmin) {
    next();
    return;
  }
  res.status(403).json({ error: buildError('common.forbidden') });
}

export function sessionUserId(req: Request): number {
  return req.session.userId as number;
}
