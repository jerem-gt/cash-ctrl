import { createAuthMiddleware } from '@jerem-gt/ctrl-shared/server/auth';
import type { Request } from 'express';

import { HttpError } from './lib/errors.js';

// Module d'auth de ctrl-shared : `currentUserId` lit le compte posé par `requireAuth`.
export { currentUserId } from '@jerem-gt/ctrl-shared/server/auth';

/** Session requise : 401 `common.unauthorized` sinon ; pose le compte lu par `currentUserId`. */
export const { requireAuth } = createAuthMiddleware(HttpError);

/** Compte de la session (modules hors auth, protégés par `requireAuth`). */
export function sessionUserId(req: Request): number {
  return req.session.userId as number;
}
