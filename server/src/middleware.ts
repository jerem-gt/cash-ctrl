import { NextFunction, Request, Response } from 'express';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    username?: string;
    isAdmin?: boolean;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.userId) {
    next();
    return;
  }
  res.status(401).json({ error: 'Non authentifié' });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.userId && req.session.isAdmin) {
    next();
    return;
  }
  res.status(403).json({ error: 'Accès refusé' });
}

export function sessionUserId(req: Request): number {
  return req.session.userId as number;
}
