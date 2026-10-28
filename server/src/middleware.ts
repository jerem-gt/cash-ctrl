import type { Database } from 'better-sqlite3';
import { NextFunction, Request, Response } from 'express';

import { buildError } from './lib/errorCodes.js';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    username?: string;
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

/** Le rôle admin est lu en base à chaque requête : une rétrogradation prend effet tout de suite. */
export function createRequireAdmin(db: Database) {
  const isAdminStmt = db.prepare<[number], { is_admin: number }>(
    'SELECT is_admin FROM users WHERE id = ?',
  );
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.session?.userId;
    if (userId && isAdminStmt.get(userId)?.is_admin === 1) {
      next();
      return;
    }
    res.status(403).json({ error: buildError('common.forbidden') });
  };
}

export function sessionUserId(req: Request): number {
  return req.session.userId as number;
}
