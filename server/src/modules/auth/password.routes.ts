import { createHash, randomBytes } from 'node:crypto';

import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import type { Mailer } from '../../lib/mailer.js';
import { FailureRateLimiter } from '../../lib/rateLimit.js';
import { parseBody, sendError } from '../../lib/routeHelpers.js';
import { createRequireAdmin, requireAuth, sessionUserId } from '../../middleware.js';
import type { SQLiteSessionStore } from '../../session-store.js';
import type { AuthRepo } from './auth.repo.js';
import type { User } from './auth.types.js';

export interface AuthLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

export interface PasswordRouterDeps {
  db: Database;
  repo: AuthRepo;
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
  lang: z.enum(['fr', 'en']).default('fr'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

type Lang = 'fr' | 'en';

const MAIL_TEXTS: Record<
  Lang,
  { subject: string; reset: (link: string, minutes: number) => string; test: string }
> = {
  fr: {
    subject: 'CashCtrl : réinitialisation du mot de passe',
    reset: (link, minutes) =>
      `Bonjour,\n\nPour choisir un nouveau mot de passe CashCtrl, ouvrez ce lien (valable ${minutes} minutes) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    test: "Ceci est un e-mail de test : l'envoi depuis CashCtrl fonctionne.",
  },
  en: {
    subject: 'CashCtrl: password reset',
    reset: (link, minutes) =>
      `Hello,\n\nTo choose a new CashCtrl password, open this link (valid for ${minutes} minutes):\n${link}\n\nIf you did not request this, you can ignore this message.`,
    test: 'This is a test email: sending from CashCtrl works.',
  },
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createPasswordRouter(deps: PasswordRouterDeps): Router {
  const { db, repo, sessionStore, mailer, appUrl, log } = deps;
  const router = Router();
  const forgotLimiter = new FailureRateLimiter(db, FORGOT_MAX_REQUESTS);
  const resetLimiter = new FailureRateLimiter(db);
  const requireAdmin = createRequireAdmin(db);

  function issueResetLink(user: User, lang: Lang): void {
    const now = Date.now();
    repo.purgeExpiredResetTokens(now);
    repo.deleteResetTokensForUser(user.id);
    const token = randomBytes(32).toString('base64url');
    repo.insertResetToken(hashToken(token), user.id, now + RESET_TOKEN_TTL_MS);

    const path = `/reset-password?token=${token}`;
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
        });
      return;
    }
    log.warn(
      `Réinitialisation du mot de passe de "${user.username}" : ouvrir ${appUrl ?? ''}${path}`,
    );
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

    const user =
      repo.getByUsername(data.identifier) ?? repo.getByEmail(data.identifier.toLowerCase());
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
    const row = repo.getResetToken(hashToken(data.token));
    if (!row || row.expires_at <= Date.now()) {
      resetLimiter.recordFailure(key);
      sendError(res, 400, 'auth.reset_token_invalid');
      return;
    }

    db.transaction(() => {
      repo.updatePassword(row.user_id, hash);
      repo.deleteResetTokensForUser(row.user_id);
    })();
    sessionStore.destroyAllSessions(row.user_id);
    resetLimiter.reset(key);
    res.json({ ok: true });
  });

  router.post('/test-email', requireAuth, requireAdmin, async (req, res) => {
    const user = repo.getById(sessionUserId(req));
    if (!user?.email) {
      sendError(res, 400, 'auth.email_missing');
      return;
    }
    if (!mailer.isConfigured()) {
      sendError(res, 503, 'auth.smtp_not_configured');
      return;
    }
    try {
      await mailer.send({
        to: user.email,
        subject: 'CashCtrl',
        text: `${MAIL_TEXTS.fr.test}\n\n${MAIL_TEXTS.en.test}`,
      });
    } catch (err) {
      log.error(`Envoi de l'e-mail de test échoué : ${String(err)}`);
      sendError(res, 502, 'auth.email_send_failed');
      return;
    }
    res.json({ ok: true });
  });

  return router;
}
