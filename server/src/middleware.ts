import { createAuthMiddleware } from '@jerem-gt/ctrl-shared/server/auth';
import type { Request } from 'express';

import { HttpError } from './lib/errors.js';

/** Session requise (module d'auth de ctrl-shared) : 401 `common.unauthorized` sinon. */
export const { requireAuth } = createAuthMiddleware(HttpError);

/** Compte de la session (modules hors auth, protégés par `requireAuth`). */
export function sessionUserId(req: Request): number {
  return req.session.userId as number;
}
