import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';
import { type NextFunction, type Request, type Response, Router } from 'express';
import * as OTPAuth from 'otpauth';
import { z } from 'zod';

import { seedUserData } from '../../db/seed.js';
import { createMailer, type Mailer } from '../../lib/mailer.js';
import { FailureRateLimiter } from '../../lib/rateLimit.js';
import { parseBody, sendError } from '../../lib/routeHelpers.js';
import { emailSchema } from '../../lib/validators.js';
import { logger } from '../../logger.js';
import { requireAuth, sessionUserId } from '../../middleware.js';
import type { SQLiteSessionStore } from '../../session-store.js';
import { createAuthRepo } from './auth.repo.js';
import type { User } from './auth.types.js';
import { type AuthLogger, createPasswordRouter } from './password.routes.js';
import { SetupToken } from './setup.js';

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(8),
});

export const enableTotpSchema = z.object({
  secret: z.string().min(1),
  code: z.string().length(6),
});

export const disableTotpSchema = z.object({
  password: z.string().min(1),
});

export const verifyTotpSchema = z.object({
  code: z.string().length(6),
});

export const setupSchema = z.object({
  token: z.string().min(1),
  username: z.string().min(1).max(64),
  password: z.string().min(8),
  lang: z.enum(['fr', 'en']).default('fr'),
});

export const profileSchema = z
  .object({
    current_password: z.string().min(1),
    username: z.string().min(1).max(64).optional(),
    email: emailSchema.nullable().optional(),
  })
  .refine((d) => d.username !== undefined || d.email !== undefined, {
    message: 'At least one field required',
  });

// Hash factice (même coût que les vrais) comparé quand l'utilisateur est inconnu,
// pour égaliser le temps de réponse et éviter l'énumération de comptes par timing.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('cashctrl-nonexistent-user', 12);

const TOTP_PENDING_TTL_MS = 5 * 60 * 1000;

function verifyTotpCode(secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.validate({ token: code, window: 1 }) !== null;
}

interface SessionUser {
  id: number;
  username: string;
  is_admin: number;
}

/** Régénère la session (anti-fixation) puis y pose l'utilisateur authentifié. */
function startSession(
  req: Request,
  res: Response,
  next: NextFunction,
  user: SessionUser,
  totpEnabled: boolean,
): void {
  req.session.regenerate((regenErr) => {
    if (regenErr) {
      next(regenErr);
      return;
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.save((saveErr) => {
      if (saveErr) {
        next(saveErr);
        return;
      }
      res.json({ username: user.username, isAdmin: user.is_admin === 1, totpEnabled });
    });
  });
}

function profileOf(user: User) {
  return {
    username: user.username,
    email: user.email,
    isAdmin: user.is_admin === 1,
    totpEnabled: user.totp_enabled === 1,
  };
}

export interface AuthRouterOptions {
  mailer?: Mailer;
  setupToken?: SetupToken;
  /** URL publique de l'application (sans slash final), pour les liens des e-mails. */
  appUrl?: string;
  log?: AuthLogger;
}

export function createAuthRouter(
  db: Database,
  sessionStore: SQLiteSessionStore,
  options: AuthRouterOptions = {},
): Router {
  const authRepo = createAuthRepo(db);
  const router = Router();
  const loginLimiter = new FailureRateLimiter(db);
  const mailer = options.mailer ?? createMailer();
  const setupToken = options.setupToken ?? new SetupToken();
  const log = options.log ?? logger;

  /** Vérifie le mot de passe actuel avec limitation des échecs ; répond 429/401 et renvoie false sinon. */
  async function checkCurrentPassword(
    res: Response,
    user: User,
    candidate: string,
  ): Promise<boolean> {
    const key = `password:${user.id}`;
    if (!loginLimiter.isAllowed(key)) {
      sendError(res, 429, 'auth.too_many_attempts');
      return false;
    }
    if (!(await bcrypt.compare(candidate, user.password_hash))) {
      loginLimiter.recordFailure(key);
      sendError(res, 401, 'auth.current_password_incorrect');
      return false;
    }
    loginLimiter.reset(key);
    return true;
  }

  router.get('/setup', (_req, res) => {
    res.json({ required: authRepo.countUsers() === 0 });
  });

  router.post('/setup', async (req, res, next) => {
    if (authRepo.countUsers() > 0) {
      sendError(res, 409, 'auth.setup_done');
      return;
    }
    const key = `setup:${req.ip ?? 'unknown'}`;
    if (!loginLimiter.isAllowed(key)) {
      sendError(res, 429, 'auth.too_many_attempts');
      return;
    }
    const data = parseBody(res, setupSchema, req.body);
    if (!data) return;

    if (!setupToken.verify(data.token)) {
      loginLimiter.recordFailure(key);
      sendError(res, 403, 'auth.setup_token_invalid');
      return;
    }

    const hash = await bcrypt.hash(data.password, 12);
    // Re-vérifie dans la transaction : deux requêtes simultanées ne créent qu'un compte.
    const userId = db.transaction((): number | null => {
      if (authRepo.countUsers() > 0) return null;
      const id = authRepo.createAdmin(data.username, hash);
      seedUserData(db, id, data.lang);
      return id;
    })();
    if (userId === null) {
      sendError(res, 409, 'auth.setup_done');
      return;
    }
    setupToken.consume();
    loginLimiter.reset(key);
    startSession(req, res, next, { id: userId, username: data.username, is_admin: 1 }, false);
  });

  router.post('/login', async (req, res, next) => {
    const key = req.ip ?? 'unknown';
    if (!loginLimiter.isAllowed(key)) {
      sendError(res, 429, 'auth.too_many_attempts');
      return;
    }

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'common.invalid_request');
      return;
    }

    const { username, password } = parsed.data;
    const user = authRepo.getByUsername(username);
    // Toujours comparer (hash factice si user absent) pour un temps constant.
    const passwordOk = await bcrypt.compare(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);

    if (!user || !passwordOk) {
      loginLimiter.recordFailure(key);
      sendError(res, 401, 'auth.invalid_credentials');
      return;
    }

    if (user.totp_enabled === 1) {
      req.session.pendingUserId = user.id;
      req.session.pendingTotpAt = Date.now();
      req.session.save(() => res.json({ totp_required: true }));
      return;
    }

    loginLimiter.reset(key);
    startSession(req, res, next, user, false);
  });

  router.post('/2fa/verify', (req, res, next) => {
    const key = req.ip ?? 'unknown';
    if (!loginLimiter.isAllowed(key)) {
      sendError(res, 429, 'auth.too_many_attempts');
      return;
    }

    const parsed = verifyTotpSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'common.invalid_request');
      return;
    }

    const { pendingUserId, pendingTotpAt } = req.session;
    if (
      pendingUserId == null ||
      pendingTotpAt == null ||
      Date.now() - pendingTotpAt > TOTP_PENDING_TTL_MS
    ) {
      sendError(res, 401, 'auth.totp_token_invalid');
      return;
    }

    const user = authRepo.getById(pendingUserId);
    if (user?.totp_enabled !== 1 || !user?.totp_secret) {
      sendError(res, 401, 'auth.totp_token_invalid');
      return;
    }

    if (!verifyTotpCode(user.totp_secret, parsed.data.code)) {
      loginLimiter.recordFailure(key);
      sendError(res, 401, 'auth.totp_invalid');
      return;
    }

    loginLimiter.reset(key);
    startSession(req, res, next, user, true);
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  router.get('/me', (req, res) => {
    if (!req.session?.userId) {
      sendError(res, 401, 'common.unauthorized');
      return;
    }
    const user = authRepo.getById(req.session.userId);
    if (!user) {
      sendError(res, 401, 'common.unauthorized');
      return;
    }
    res.json(profileOf(user));
  });

  router.patch('/profile', requireAuth, async (req, res) => {
    const data = parseBody(res, profileSchema, req.body);
    if (!data) return;

    const userId = sessionUserId(req);
    const user = authRepo.getById(userId);
    if (!user) {
      sendError(res, 401, 'common.unauthorized');
      return;
    }
    if (!(await checkCurrentPassword(res, user, data.current_password))) return;

    const { username, email } = data;
    if (username !== undefined) {
      const owner = authRepo.usernameOwner(username);
      if (owner !== undefined && owner !== userId) {
        sendError(res, 409, 'user.username_taken');
        return;
      }
    }
    if (email !== undefined && email !== null) {
      const owner = authRepo.emailOwner(email);
      if (owner !== undefined && owner !== userId) {
        sendError(res, 409, 'user.email_taken');
        return;
      }
    }

    if (username !== undefined) {
      authRepo.updateUsername(userId, username);
      req.session.username = username;
    }
    if (email !== undefined) authRepo.updateEmail(userId, email);

    res.json(profileOf(authRepo.getById(userId) as User));
  });

  router.post('/change-password', requireAuth, async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'auth.password_too_short');
      return;
    }

    const userId = sessionUserId(req);
    const user = authRepo.getById(userId);
    if (!user) {
      sendError(res, 401, 'auth.current_password_incorrect');
      return;
    }
    if (!(await checkCurrentPassword(res, user, parsed.data.current))) return;

    authRepo.updatePassword(userId, await bcrypt.hash(parsed.data.next, 12));
    sessionStore.destroyOtherSessions(userId, req.sessionID);
    res.json({ ok: true });
  });

  // Génère un nouveau secret TOTP et retourne l'URI pour le QR code.
  // Le secret n'est PAS encore enregistré — il faut confirmer avec /2fa/enable.
  router.post('/2fa/setup', requireAuth, (req, res) => {
    const userId = sessionUserId(req);
    const user = authRepo.getById(userId);
    if (!user) {
      sendError(res, 401, 'common.unauthorized');
      return;
    }
    if (user.totp_enabled === 1) {
      sendError(res, 409, 'auth.totp_already_enabled');
      return;
    }

    const secret = new OTPAuth.Secret();
    const totp = new OTPAuth.TOTP({
      issuer: 'CashCtrl',
      label: user.username,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    res.json({ uri: totp.toString(), secret: secret.base32 });
  });

  // Vérifie le premier code et active la 2FA.
  router.post('/2fa/enable', requireAuth, (req, res) => {
    const parsed = enableTotpSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'common.invalid_request');
      return;
    }

    const userId = sessionUserId(req);
    const user = authRepo.getById(userId);
    if (!user) {
      sendError(res, 401, 'common.unauthorized');
      return;
    }
    if (user.totp_enabled === 1) {
      sendError(res, 409, 'auth.totp_already_enabled');
      return;
    }

    if (!verifyTotpCode(parsed.data.secret, parsed.data.code)) {
      sendError(res, 401, 'auth.totp_invalid');
      return;
    }

    authRepo.enableTotp(userId, parsed.data.secret);
    res.json({ ok: true });
  });

  // Désactive la 2FA après vérification du mot de passe.
  router.post('/2fa/disable', requireAuth, async (req, res) => {
    const parsed = disableTotpSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'common.invalid_request');
      return;
    }

    const userId = sessionUserId(req);
    const user = authRepo.getById(userId);
    if (!user) {
      sendError(res, 401, 'common.unauthorized');
      return;
    }
    if (user.totp_enabled !== 1) {
      sendError(res, 409, 'auth.totp_not_enabled');
      return;
    }

    if (!(await checkCurrentPassword(res, user, parsed.data.password))) return;

    authRepo.disableTotp(userId);
    res.json({ ok: true });
  });

  router.use(
    createPasswordRouter({
      db,
      repo: authRepo,
      sessionStore,
      mailer,
      appUrl: options.appUrl,
      log,
    }),
  );

  return router;
}
