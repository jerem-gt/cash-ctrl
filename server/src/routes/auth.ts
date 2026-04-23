import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import type { User } from '../db.js';
import { requireAuth } from '../middleware.js';

export function createAuthRouter(db: Database.Database): Router {
  const getUserByUsername = db.prepare<[string], User>('SELECT * FROM users WHERE username = ?');
  const getUserById      = db.prepare<[number], User>('SELECT * FROM users WHERE id = ?');
  const updatePassword   = db.prepare<[string, number]>('UPDATE users SET password_hash = ? WHERE id = ?');

  const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  });

  const changePasswordSchema = z.object({
    current: z.string().min(1),
    next: z.string().min(8),
  });

  const router = Router();

  router.post('/login', (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const { username, password } = parsed.data;
    const user = getUserByUsername.get(username);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    req.session.userId = user.id;
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

    const user = getUserById.get(req.session.userId!);
    if (!user || !bcrypt.compareSync(parsed.data.current, user.password_hash)) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const hash = bcrypt.hashSync(parsed.data.next, 12);
    updatePassword.run(hash, req.session.userId!);
    res.json({ ok: true });
  });

  return router;
}
