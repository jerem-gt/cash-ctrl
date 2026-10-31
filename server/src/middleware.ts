import type { Database } from 'better-sqlite3';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { sendError } from './lib/errorCodes.js';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    /** Mot de passe vérifié, code TOTP attendu (`POST /api/auth/2fa/verify`). */
    pendingUserId?: number;
    pendingTotpAt?: number;
    /** Secret proposé par `/2fa/setup`, en attente de confirmation par `/2fa/enable`. */
    pendingTotpSecret?: string;
  }
}

/** Le compte de la requête est posé dans `res.locals.userId`, lu par `currentUserId`. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = req.session?.userId;
  if (userId) {
    res.locals.userId = userId;
    next();
    return;
  }
  sendError(res, 401, 'common.unauthorized');
}

/** Compte de la requête, posé par `requireAuth`. */
export function currentUserId(res: Response): number {
  return res.locals.userId;
}

/** Compte de la session (modules hors auth, protégés par `requireAuth`). */
export function sessionUserId(req: Request): number {
  return req.session.userId as number;
}

/**
 * Réservé aux admins, après `requireAuth`. Le rôle est lu en base à chaque requête : une
 * rétrogradation prend effet tout de suite.
 */
export function createRequireAdmin(db: Database): RequestHandler {
  const isAdminStmt = db.prepare<[number], { is_admin: number }>(
    'SELECT is_admin FROM users WHERE id = ?',
  );
  return (_req, res, next) => {
    const userId = res.locals.userId as number | undefined;
    if (userId && isAdminStmt.get(userId)?.is_admin === 1) {
      next();
      return;
    }
    sendError(res, 403, 'common.forbidden');
  };
}
