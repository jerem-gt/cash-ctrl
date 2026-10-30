import { randomBytes } from 'node:crypto';

import { sha256Hex } from '@jerem-gt/ctrl-shared/server/crypto';
import { createMailer, type Mailer } from '@jerem-gt/ctrl-shared/server/mailer';
import { FailureRateLimiter } from '@jerem-gt/ctrl-shared/server/rateLimit';
import type { SQLiteSessionStore } from '@jerem-gt/ctrl-shared/server/session-store';
import { SetupToken } from '@jerem-gt/ctrl-shared/server/setup';
import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';
import { type NextFunction, type Request, type Response, Router } from 'express';
import * as OTPAuth from 'otpauth';
import { z } from 'zod';

import { seedUserData } from '../../db/seed.js';
import { readCookie } from '../../lib/cookies.js';
import { parseBody, parseNumberParam, sendError } from '../../lib/routeHelpers.js';
import { deviceLabel } from '../../lib/userAgent.js';
import { emailSchema, langSchema, usernameSchema } from '../../lib/validators.js';
import { type AuthLogger, logger } from '../../logger.js';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createUsersRepo } from '../users/users.repo.js';
import { createAuthRepo } from './auth.repo.js';
import type { User } from './auth.types.js';
import { createMailRouter } from './mail.routes.js';
import { createPasswordRouter } from './password.routes.js';
import { revokeTrustedDevices } from './trustedDevices.js';

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(8),
});

// Le secret à confirmer est gardé en session par /2fa/setup : seul le code est envoyé.
export const enableTotpSchema = z.object({
  code: z.string().length(6),
});

export const disableTotpSchema = z.object({
  password: z.string().min(1),
});

export const verifyTotpSchema = z.object({
  code: z.string().length(6),
  remember: z.boolean().optional().default(false),
});

export const setupSchema = z.object({
  token: z.string().min(1),
  username: usernameSchema,
  password: z.string().min(8),
  lang: langSchema,
});

export const profileSchema = z
  .object({
    current_password: z.string().min(1),
    username: usernameSchema.optional(),
    email: emailSchema.nullable().optional(),
  })
  .refine((d) => d.username !== undefined || d.email !== undefined, {
    message: 'At least one field required',
  });

// Hash factice (même coût que les vrais) comparé quand l'utilisateur est inconnu,
// pour égaliser le temps de réponse et éviter l'énumération de comptes par timing.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('cashctrl-nonexistent-user', 12);

const TOTP_PENDING_TTL_MS = 5 * 60 * 1000;

/**
 * Pas (numéro de la période de 30 s) du code s'il est valide à une période près, sinon null.
 * Le pas accepté est mémorisé : un code ne sert qu'une fois (anti-rejeu, RFC 6238 §5.2).
 */
function matchTotpStep(secret: string, code: string): number | null {
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  const now = Date.now();
  const delta = totp.validate({ token: code, timestamp: now, window: 1 });
  return delta === null ? null : totp.counter({ timestamp: now }) + delta;
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
      res.json({
        id: user.id,
        username: user.username,
        isAdmin: user.is_admin === 1,
        totpEnabled,
      });
    });
  });
}

function profileOf(user: User) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: user.is_admin === 1,
    totpEnabled: user.totp_enabled === 1,
  };
}

const DEVICE_COOKIE = 'cashctrl_device';
const DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function deviceTokenOf(req: Request): string | undefined {
  return readCookie(req.headers.cookie, DEVICE_COOKIE);
}

export interface AuthRouterOptions {
  /** Cookie d'appareil mémorisé en `Secure` (SECURE_COOKIE=true). */
  secureCookies?: boolean;
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
  const usersRepo = createUsersRepo(db);
  const router = Router();
  const loginLimiter = new FailureRateLimiter(db);
  const mailer = options.mailer ?? createMailer();
  const setupToken = options.setupToken ?? new SetupToken();
  const log = options.log ?? logger;
  // Comme le cookie de session (secure: 'auto') : Secure seulement si la requête est en HTTPS
  function deviceCookieOptions(res: Response) {
    return {
      httpOnly: true,
      sameSite: 'strict' as const,
      secure: options.secureCookies === true && res.req.secure,
      path: '/api/auth',
    };
  }

  function setDeviceCookie(res: Response, token: string): void {
    res.cookie(DEVICE_COOKIE, token, { ...deviceCookieOptions(res), maxAge: DEVICE_TTL_MS });
  }

  function clearDeviceCookie(res: Response): void {
    res.clearCookie(DEVICE_COOKIE, deviceCookieOptions(res));
  }

  /** Mémorise l'appareil courant ; remplace l'éventuel appareil déjà porté par le cookie. */
  function rememberDevice(req: Request, res: Response, userId: number): void {
    const now = Date.now();
    authRepo.purgeExpiredDevices(now);
    const previous = deviceTokenOf(req);
    if (previous) authRepo.deleteDeviceByHash(sha256Hex(previous));
    const token = randomBytes(32).toString('base64url');
    authRepo.insertDevice(
      userId,
      sha256Hex(token),
      deviceLabel(req.get('user-agent')),
      now,
      now + DEVICE_TTL_MS,
    );
    setDeviceCookie(res, token);
  }

  /** Vrai si le cookie désigne un appareil valide du compte ; nettoie le cookie s'il est mort. */
  function isTrustedDevice(req: Request, res: Response, userId: number): boolean {
    const token = deviceTokenOf(req);
    if (!token) return false;
    const now = Date.now();
    authRepo.purgeExpiredDevices(now);
    const device = authRepo.getDeviceByHash(sha256Hex(token));
    if (device === undefined) {
      clearDeviceCookie(res);
      return false;
    }
    if (device.user_id !== userId) return false;
    authRepo.touchDevice(device.id, now);
    return true;
  }

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
      if (isTrustedDevice(req, res, user.id)) {
        loginLimiter.reset(key);
        startSession(req, res, next, user, true);
        return;
      }
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

    // Limité par compte en plus de l'IP : un attaquant qui a le mot de passe et change d'adresse.
    const accountKey = `totp:${user.id}`;
    if (!loginLimiter.isAllowed(accountKey)) {
      sendError(res, 429, 'auth.too_many_attempts');
      return;
    }

    const step = matchTotpStep(user.totp_secret, parsed.data.code);
    if (step === null || !authRepo.consumeTotpStep(user.id, step)) {
      loginLimiter.recordFailure(key);
      loginLimiter.recordFailure(accountKey);
      sendError(res, 401, 'auth.totp_invalid');
      return;
    }

    loginLimiter.reset(key);
    loginLimiter.reset(accountKey);
    if (parsed.data.remember) rememberDevice(req, res, user.id);
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
      const owner = usersRepo.getByUsername(username);
      if (owner !== undefined && owner.id !== userId) {
        sendError(res, 409, 'user.username_taken');
        return;
      }
    }
    if (email !== undefined && email !== null) {
      const owner = usersRepo.getByEmail(email);
      if (owner !== undefined && owner.id !== userId) {
        sendError(res, 409, 'user.email_taken');
        return;
      }
    }

    if (username !== undefined) {
      usersRepo.updateUsername(userId, username);
      req.session.username = username;
    }
    if (email !== undefined) usersRepo.updateEmail(userId, email);

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
    revokeTrustedDevices(db, userId);
    sessionStore.destroyOtherSessions(userId, req.sessionID);
    res.json({ ok: true });
  });

  // Génère un nouveau secret TOTP et retourne l'URI pour le QR code.
  // Le secret est gardé en session, pas encore enregistré : il faut confirmer avec /2fa/enable.
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

    req.session.pendingTotpSecret = secret.base32;
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

    const secret = req.session.pendingTotpSecret;
    if (!secret) {
      sendError(res, 400, 'auth.totp_setup_expired');
      return;
    }

    const step = matchTotpStep(secret, parsed.data.code);
    if (step === null) {
      sendError(res, 401, 'auth.totp_invalid');
      return;
    }

    db.transaction(() => {
      authRepo.enableTotp(userId, secret, step);
      revokeTrustedDevices(db, userId);
    })();
    delete req.session.pendingTotpSecret;
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

    db.transaction(() => {
      usersRepo.disableTotp(userId);
      revokeTrustedDevices(db, userId);
    })();
    res.json({ ok: true });
  });

  router.get('/devices', requireAuth, (req, res) => {
    const now = Date.now();
    authRepo.purgeExpiredDevices(now);
    const token = deviceTokenOf(req);
    const currentHash = token ? sha256Hex(token) : null;
    res.json(
      authRepo.listDevices(sessionUserId(req), now).map((d) => ({
        id: d.id,
        label: d.label,
        created_at: d.created_at,
        last_used_at: d.last_used_at,
        expires_at: d.expires_at,
        current: d.token_hash === currentHash,
      })),
    );
  });

  router.delete('/devices/:id', requireAuth, (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const device = authRepo.getDevice(id, sessionUserId(req));
    if (!device) {
      sendError(res, 404, 'auth.device_not_found');
      return;
    }
    authRepo.deleteDevice(id, device.user_id);
    const token = deviceTokenOf(req);
    if (token && sha256Hex(token) === device.token_hash) clearDeviceCookie(res);
    res.json({ ok: true });
  });

  router.delete('/devices', requireAuth, (req, res) => {
    const userId = sessionUserId(req);
    const token = deviceTokenOf(req);
    const ownsCookie =
      token !== undefined && authRepo.getDeviceByHash(sha256Hex(token))?.user_id === userId;
    revokeTrustedDevices(db, userId);
    if (ownsCookie) clearDeviceCookie(res);
    res.json({ ok: true });
  });

  router.use(
    createPasswordRouter({
      db,
      repo: authRepo,
      usersRepo,
      sessionStore,
      mailer,
      appUrl: options.appUrl,
      log,
    }),
  );

  router.use(createMailRouter({ db, repo: authRepo, mailer, log }));

  return router;
}
