import type { Database, RunResult } from 'better-sqlite3';
import { type Response, Router } from 'express';
import { z } from 'zod';

import { currentUserId, requireAuth } from '../middleware.js';
import type { ErrorCode } from './errorCodes.js';
import { ConflictError } from './errors.js';
import { assertFound, parseIdParam } from './routeHelpers.js';

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

  const getRepo = (res: Response) => config.repoFactory(db, currentUserId(res));

  router.get('/', (_req, res) => {
    res.json(getRepo(res).getAll());
  });

  router.post('/', (req, res) => {
    const data = config.schema.parse(req.body);
    const repo = getRepo(res);
    const result = repo.create({ name: data.name.trim(), icon: data.icon });
    res.status(201).json(repo.getById(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = parseIdParam(req);
    const repo = getRepo(res);
    assertFound(repo, id, config.notFoundCode);
    const data = config.schema.parse(req.body);
    repo.update(id, { name: data.name.trim(), icon: data.icon });
    res.json(repo.getById(id));
  });

  router.delete('/:id', (req, res) => {
    const id = parseIdParam(req);
    const repo = getRepo(res);
    assertFound(repo, id, config.notFoundCode);
    const n = config.countUsage(id);
    if (n > 0) {
      throw new ConflictError(config.usageConflictCode, { count: n });
    }
    repo.delete(id);
    res.status(204).end();
  });

  return router;
}
