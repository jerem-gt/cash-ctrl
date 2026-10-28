import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { seedUserData } from '../../db/seed.js';
import type { ErrorCode } from '../../lib/errorCodes.js';
import { parseBody, parseNumberParam, sendError, zodToApiError } from '../../lib/routeHelpers.js';
import { emailSchema } from '../../lib/validators.js';
import { createRequireAdmin, sessionUserId } from '../../middleware.js';
import type { SQLiteSessionStore } from '../../session-store.js';
import { createUsersRepo } from './users.repo.js';

export const createUserSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8),
  email: emailSchema.nullable().optional(),
  lang: z.enum(['fr', 'en']).default('fr'),
});

export const updateUserSchema = z
  .object({
    username: z.string().min(1).max(64).optional(),
    password: z.string().min(8).optional(),
    email: emailSchema.nullable().optional(),
    is_admin: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.username !== undefined ||
      d.password !== undefined ||
      d.email !== undefined ||
      d.is_admin !== undefined,
    { message: 'At least one field required' },
  );

export function createUsersRouter(db: Database, sessionStore: SQLiteSessionStore): Router {
  const repo = createUsersRepo(db);
  const router = Router();

  router.use(createRequireAdmin(db));

  router.get('/', (_req, res) => {
    res.json(repo.list());
  });

  router.post('/', (req, res) => {
    const data = parseBody(res, createUserSchema, req.body);
    if (!data) return;
    const { username, password, lang } = data;
    const email = data.email ?? null;
    if (repo.getByUsername(username)) {
      sendError(res, 409, 'user.username_taken');
      return;
    }
    if (email !== null && repo.getByEmail(email)) {
      sendError(res, 409, 'user.email_taken');
      return;
    }
    const hash = bcrypt.hashSync(password, 12);
    const newUser = db.transaction(() => {
      const created = repo.create(username, hash, email);
      seedUserData(db, created.id, lang);
      return created;
    })();
    res.status(201).json(newUser);
  });

  router.patch('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const user = repo.getById(id);
    if (!user) {
      sendError(res, 404, 'user.not_found');
      return;
    }
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: zodToApiError(parsed.error) });
      return;
    }
    const { username, password, email, is_admin: isAdmin } = parsed.data;

    const usernameOwner = username === undefined ? undefined : repo.getByUsername(username);
    const emailOwner = email ? repo.getByEmail(email) : undefined;
    const demotesLastAdmin = isAdmin === false && user.is_admin === 1 && repo.countAdmins() <= 1;
    let conflict: ErrorCode | null = null;
    if (usernameOwner && usernameOwner.id !== id) {
      conflict = 'user.username_taken';
    } else if (emailOwner && emailOwner.id !== id) {
      conflict = 'user.email_taken';
    } else if (demotesLastAdmin) {
      conflict = 'user.last_admin';
    }
    if (conflict !== null) {
      sendError(res, 409, conflict);
      return;
    }

    const hash = password === undefined ? null : bcrypt.hashSync(password, 12);
    db.transaction(() => {
      if (username !== undefined) repo.updateUsername(id, username);
      if (email !== undefined) repo.updateEmail(id, email);
      if (isAdmin !== undefined) repo.updateAdmin(id, isAdmin);
      if (hash !== null) repo.updatePassword(id, hash);
    })();
    // Mot de passe d'un autre compte redéfini : ses sessions ouvertes sont fermées.
    if (hash !== null && id !== sessionUserId(req)) {
      sessionStore.destroyAllSessions(id);
    }
    res.json(repo.getById(id));
  });

  router.delete('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const user = repo.getById(id);
    if (!user) {
      sendError(res, 404, 'user.not_found');
      return;
    }
    if (id === sessionUserId(req)) {
      sendError(res, 409, 'user.cannot_delete_self');
      return;
    }
    if (user.is_admin === 1 && repo.countAdmins() <= 1) {
      sendError(res, 409, 'user.last_admin');
      return;
    }
    repo.remove(id);
    sessionStore.destroyAllSessions(id);
    res.json({ ok: true });
  });

  router.delete('/:id/2fa', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const user = repo.getById(id);
    if (!user) {
      sendError(res, 404, 'user.not_found');
      return;
    }
    if (user.totp_enabled !== 1) {
      sendError(res, 409, 'auth.totp_not_enabled');
      return;
    }
    repo.disableTotp(id);
    res.json({ ok: true });
  });

  return router;
}
