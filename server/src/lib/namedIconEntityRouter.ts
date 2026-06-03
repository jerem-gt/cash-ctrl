import type { Database, RunResult } from 'better-sqlite3';
import { type Request, Router } from 'express';
import { z } from 'zod';

import { requireAuth, sessionUserId } from '../middleware';
import type { ErrorCode } from './errorCodes';
import { parseBody, parseNumberParam, requireById, sendError } from './routeHelpers';

/** Payload partagé des entités « nom + icône » (catégories, moyens de paiement). */
export interface NamedIconEntityInput {
  name: string;
  icon: string;
}

/** Forme de repo attendue (scopé à un utilisateur via la factory). */
export interface NamedIconEntityRepo {
  getAll(): unknown;
  getById(id: number): unknown;
  create(data: NamedIconEntityInput): RunResult;
  update(id: number, data: NamedIconEntityInput): RunResult;
  delete(id: number): RunResult;
}

export interface NamedIconEntityRouterConfig {
  schema: z.ZodType<NamedIconEntityInput>;
  /** Construit le repo scopé à l'utilisateur de la requête. */
  repoFactory: (db: Database, userId: number) => NamedIconEntityRepo;
  notFoundCode: ErrorCode;
  /** Nombre d'usages bloquant la suppression (ex. transactions liées). */
  countUsage: (id: number) => number;
  usageConflictCode: ErrorCode;
}

/**
 * Routeur CRUD générique pour les entités « nom + icône » possédées par un
 * utilisateur (catégories, moyens de paiement). Mutualise list/create/update/
 * delete, la suppression étant refusée (409) si l'entité est encore utilisée.
 */
export function createNamedIconEntityRouter(
  db: Database,
  config: NamedIconEntityRouterConfig,
): Router {
  const router = Router();
  router.use(requireAuth);

  const getRepo = (req: Request) => config.repoFactory(db, sessionUserId(req));

  router.get('/', (req, res) => {
    res.json(getRepo(req).getAll());
  });

  router.post('/', (req, res) => {
    const data = parseBody(res, config.schema, req.body);
    if (!data) return;
    const repo = getRepo(req);
    const result = repo.create({ name: data.name.trim(), icon: data.icon });
    res.status(201).json(repo.getById(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const repo = getRepo(req);
    if (!requireById(res, repo, id, config.notFoundCode)) return;
    const data = parseBody(res, config.schema, req.body);
    if (!data) return;
    repo.update(id, { name: data.name.trim(), icon: data.icon });
    res.json(repo.getById(id));
  });

  router.delete('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const repo = getRepo(req);
    if (!requireById(res, repo, id, config.notFoundCode)) return;
    const n = config.countUsage(id);
    if (n > 0) {
      sendError(res, 409, config.usageConflictCode, { count: n });
      return;
    }
    repo.delete(id);
    res.json({ ok: true });
  });

  return router;
}
