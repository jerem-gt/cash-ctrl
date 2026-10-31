import { createAuthMiddleware } from '@jerem-gt/ctrl-shared/server/auth';

import { HttpError } from './lib/errors.js';

/** Session requise (module d'auth de ctrl-shared) : 401 `common.unauthorized` sinon. */
export const { requireAuth } = createAuthMiddleware(HttpError);

/** Compte de la requête, posé par `requireAuth` (comme shelf-ctrl). */
export { currentUserId } from '@jerem-gt/ctrl-shared/server/auth';
