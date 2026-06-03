import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { seedUserData } from '../../db/seed.js';
import { parseNumberParam } from '../../lib/routeHelpers.js';
import { requireAdmin } from '../../middleware.js';
import { createUsersRepo } from './users.repo';

const createUserSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8),
  lang: z.enum(['fr', 'en']).default('fr'),
});

const updateUserSchema = z
  .object({
    username: z.string().min(1).max(64).optional(),
    password: z.string().min(8).optional(),
  })
  .refine((d) => d.username !== undefined || d.password !== undefined, {
    message: 'At least one field required',
  });

export function createUsersRouter(db: Database): Router {
  const repo = createUsersRepo(db);
  const router = Router();

  router.use(requireAdmin);

  router.get('/', (_req, res) => {
    res.json(repo.list());
  });

  router.post('/', (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Requête invalide' });
      return;
    }
    const { username, password, lang } = parsed.data;
    if (repo.getByUsername(username)) {
      res.status(409).json({ error: "Nom d'utilisateur déjà utilisé" });
      return;
    }
    const hash = bcrypt.hashSync(password, 12);
    const newUser = repo.create(username, hash);
    seedUserData(db, newUser.id, lang);
    res.status(201).json(newUser);
  });

  router.patch('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const user = repo.getById(id);
    if (!user) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    if (user.is_admin === 1) {
      res.status(403).json({ error: 'Impossible de modifier le compte administrateur' });
      return;
    }
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide' });
      return;
    }
    if (parsed.data.username !== undefined) {
      if (repo.getByUsername(parsed.data.username)) {
        res.status(409).json({ error: "Nom d'utilisateur déjà utilisé" });
        return;
      }
      repo.updateUsername(id, parsed.data.username);
    }
    if (parsed.data.password !== undefined) {
      repo.updatePassword(id, bcrypt.hashSync(parsed.data.password, 12));
    }
    res.json(repo.getById(id));
  });

  router.delete('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const user = repo.getById(id);
    if (!user) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    if (user.is_admin === 1) {
      res.status(403).json({ error: 'Impossible de supprimer le compte administrateur' });
      return;
    }
    repo.remove(id);
    res.json({ ok: true });
  });

  return router;
}
