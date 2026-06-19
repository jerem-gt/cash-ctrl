import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import * as OTPAuth from 'otpauth';
import { z } from 'zod';

import { FailureRateLimiter } from '../../lib/rateLimit.js';
import { sendError } from '../../lib/routeHelpers';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createAuthRepo } from './auth.repo';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(8),
});

const enableTotpSchema = z.object({
  secret: z.string().min(1),
  code: z.string().length(6),
});

const disableTotpSchema = z.object({
  password: z.string().min(1),
});

const verifyTotpSchema = z.object({
  code: z.string().length(6),
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

export function createAuthRouter(db: Database): Router {
  const authRepo = createAuthRepo(db);
  const router = Router();
  const loginLimiter = new FailureRateLimiter(db);

  router.post('/login', async (req, res) => {
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

    loginLimiter.reset(key);

    if (user.totp_enabled === 1) {
      req.session.pendingUserId = user.id;
      req.session.pendingTotpAt = Date.now();
      req.session.save(() => res.json({ totp_required: true }));
      return;
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isAdmin = user.is_admin === 1;
    req.session.save(() =>
      res.json({ username: user.username, isAdmin: user.is_admin === 1, totpEnabled: false }),
    );
  });

  router.post('/2fa/verify', (req, res) => {
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
      sendError(res, 401, 'auth.totp_invalid');
      return;
    }

    delete req.session.pendingUserId;
    delete req.session.pendingTotpAt;
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isAdmin = user.is_admin === 1;
    req.session.save(() =>
      res.json({ username: user.username, isAdmin: user.is_admin === 1, totpEnabled: true }),
    );
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
    res.json({
      username: user.username,
      isAdmin: user.is_admin === 1,
      totpEnabled: user.totp_enabled === 1,
    });
  });

  router.post('/change-password', requireAuth, async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'auth.password_too_short');
      return;
    }

    const userId = sessionUserId(req);
    const user = authRepo.getById(userId);
    if (!user || !(await bcrypt.compare(parsed.data.current, user.password_hash))) {
      sendError(res, 401, 'auth.current_password_incorrect');
      return;
    }

    authRepo.updatePassword(userId, await bcrypt.hash(parsed.data.next, 12));
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

    if (!(await bcrypt.compare(parsed.data.password, user.password_hash))) {
      sendError(res, 401, 'auth.current_password_incorrect');
      return;
    }

    authRepo.disableTotp(userId);
    res.json({ ok: true });
  });

  return router;
}
