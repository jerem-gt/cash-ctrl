import { randomBytes } from 'node:crypto';

import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { sha256Hex } from '../../lib/crypto.js';
import type { Mailer } from '../../lib/mailer.js';
import { MAIL_TEXTS } from '../../lib/mailTexts.js';
import { FailureRateLimiter } from '../../lib/rateLimit.js';
import { parseBody, sendError } from '../../lib/routeHelpers.js';
import type { Lang } from '../../lib/systemEntities.js';
import { langSchema } from '../../lib/validators.js';
import type { AuthLogger } from '../../logger.js';
import type { SQLiteSessionStore } from '../../session-store.js';
import type { createUsersRepo } from '../users/users.repo.js';
import type { AuthRepo } from './auth.repo.js';
import type { User } from './auth.types.js';
import { revokeTrustedDevices } from './trustedDevices.js';

export interface PasswordRouterDeps {
  db: Database;
  repo: AuthRepo;
  usersRepo: ReturnType<typeof createUsersRepo>;
  sessionStore: SQLiteSessionStore;
  mailer: Mailer;
  /** URL publique de l'application, sans slash final (jamais déduite de l'en-tête Host). */
  appUrl: string | undefined;
  log: AuthLogger;
}

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const FORGOT_MAX_REQUESTS = 5;

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  lang: langSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export function createPasswordRouter(deps: PasswordRouterDeps): Router {
  const { db, repo, usersRepo, sessionStore, mailer, appUrl, log } = deps;
  const router = Router();
  const forgotLimiter = new FailureRateLimiter(db, FORGOT_MAX_REQUESTS);
  const resetLimiter = new FailureRateLimiter(db);

  function issueResetLink(user: User, lang: Lang): void {
    const now = Date.now();
    repo.purgeExpiredResetTokens(now);
    repo.deleteResetTokensForUser(user.id);
    const token = randomBytes(32).toString('base64url');
    repo.insertResetToken(sha256Hex(token), user.id, now + RESET_TOKEN_TTL_MS);

    const path = `/reset-password?token=${token}`;
    const fallbackMessage = `Réinitialisation du mot de passe de "${user.username}" : ouvrir ${appUrl ?? ''}${path}`;
    if (mailer.isConfigured() && user.email && appUrl) {
      const texts = MAIL_TEXTS[lang];
      mailer
        .send({
          to: user.email,
          subject: texts.subject,
          text: texts.reset(`${appUrl}${path}`, RESET_TOKEN_TTL_MS / 60_000),
        })
        .catch((err: unknown) => {
          log.error(`Envoi de l'e-mail de réinitialisation échoué : ${String(err)}`);
          log.warn(fallbackMessage);
        });
      return;
    }
    log.warn(fallbackMessage);
  }

  router.post('/password/forgot', (req, res) => {
    const key = `forgot:${req.ip ?? 'unknown'}`;
    if (!forgotLimiter.isAllowed(key)) {
      sendError(res, 429, 'auth.too_many_attempts');
      return;
    }
    // Chaque requête compte, qu'elle aboutisse ou non.
    forgotLimiter.recordFailure(key);

    const data = parseBody(res, forgotPasswordSchema, req.body);
    if (!data) return;

    const emailOwnerId = usersRepo.getByEmail(data.identifier.toLowerCase())?.id;
    const user =
      repo.getByUsername(data.identifier) ??
      (emailOwnerId === undefined ? undefined : repo.getById(emailOwnerId));
    if (user) {
      try {
        issueResetLink(user, data.lang);
      } catch (err) {
        log.error(`Création du lien de réinitialisation échouée : ${String(err)}`);
      }
    }
    res.json({ ok: true });
  });

  router.post('/password/reset', async (req, res) => {
    const key = `reset:${req.ip ?? 'unknown'}`;
    if (!resetLimiter.isAllowed(key)) {
      sendError(res, 429, 'auth.too_many_attempts');
      return;
    }
    const data = parseBody(res, resetPasswordSchema, req.body);
    if (!data) return;

    const hash = await bcrypt.hash(data.password, 12);
    const row = repo.getResetToken(sha256Hex(data.token));
    if (!row || row.expires_at <= Date.now()) {
      resetLimiter.recordFailure(key);
      sendError(res, 400, 'auth.reset_token_invalid');
      return;
    }

    db.transaction(() => {
      repo.updatePassword(row.user_id, hash);
      repo.deleteResetTokensForUser(row.user_id);
      revokeTrustedDevices(db, row.user_id);
    })();
    sessionStore.destroyAllSessions(row.user_id);
    resetLimiter.reset(key);
    res.json({ ok: true });
  });

  return router;
}
