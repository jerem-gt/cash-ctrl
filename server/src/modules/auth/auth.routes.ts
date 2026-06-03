import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { FailureRateLimiter } from '../../lib/rateLimit.js';
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

// Hash factice (même coût que les vrais) comparé quand l'utilisateur est inconnu,
// pour égaliser le temps de réponse et éviter l'énumération de comptes par timing.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('cashctrl-nonexistent-user', 12);

export function createAuthRouter(db: Database): Router {
  const authRepo = createAuthRepo(db);
  const router = Router();
  const loginLimiter = new FailureRateLimiter();

  router.post('/login', async (req, res) => {
    const key = req.ip ?? 'unknown';
    if (!loginLimiter.isAllowed(key)) {
      res.status(429).json({ error: 'Trop de tentatives. Réessayez plus tard.' });
      return;
    }

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const { username, password } = parsed.data;
    const user = authRepo.getByUsername(username);
    // Toujours comparer (hash factice si user absent) pour un temps constant.
    const passwordOk = await bcrypt.compare(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);

    if (!user || !passwordOk) {
      loginLimiter.recordFailure(key);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    loginLimiter.reset(key);
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isAdmin = user.is_admin === 1;
    req.session.save(() => res.json({ username: user.username, isAdmin: user.is_admin === 1 }));
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  router.get('/me', (req, res) => {
    if (req.session?.userId) {
      res.json({ username: req.session.username, isAdmin: req.session.isAdmin ?? false });
      return;
    }
    res.status(401).json({ error: 'Unauthorized' });
  });

  router.post('/change-password', requireAuth, async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const userId = sessionUserId(req);
    const user = authRepo.getById(userId);
    if (!user || !(await bcrypt.compare(parsed.data.current, user.password_hash))) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    authRepo.updatePassword(userId, await bcrypt.hash(parsed.data.next, 12));
    res.json({ ok: true });
  });

  return router;
}
