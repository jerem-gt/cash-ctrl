import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../../middleware.js';
import { createAuthRepo } from './auth.repo';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(8),
});

export function createAuthRouter(db: Database): Router {
  const authRepo = createAuthRepo(db);
  const router = Router();

  router.post('/login', (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const { username, password } = parsed.data;
    const user = authRepo.getByUsername(username);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    req.session.userId! = user.id;
    req.session.username = user.username;
    req.session.save(() => res.json({ username: user.username }));
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  router.get('/me', (req, res) => {
    if (req.session?.userId) {
      res.json({ username: req.session.username });
      return;
    }
    res.status(401).json({ error: 'Unauthorized' });
  });

  router.post('/change-password', requireAuth, (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const userId = req.session.userId!;
    const user = authRepo.getById(userId);
    if (!user || !bcrypt.compareSync(parsed.data.current, user.password_hash)) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    authRepo.updatePassword(userId, bcrypt.hashSync(parsed.data.next, 12));
    res.json({ ok: true });
  });

  return router;
}
