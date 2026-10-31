import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors.js';
import { assertFound, parseIdParam } from '../../lib/routeHelpers.js';
import { nameSchema } from '../../lib/validators.js';
import { LOGOS_DIR } from '../../logoDownloader.js';
import { requireAuth } from '../../middleware.js';
import { createAccountsRepo } from '../accounts/accounts.repo.js';
import { createBanksRepo } from './banks.repo.js';

export const bankSchema = z.object({
  name: nameSchema,
  login_url: z.url().nullable().optional(),
});

export const reorderSchema = z.array(
  z.object({ id: z.number().int(), sort_order: z.number().int() }),
);

const upload = multer({
  storage: multer.diskStorage({
    destination: LOGOS_DIR,
    filename: (req, _file, cb) => cb(null, `bank-${String(req.params.id)}-${Date.now()}.png`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

export function createBanksRouter(db: Database): Router {
  const banksRepo = createBanksRepo(db);
  const accountsRepo = createAccountsRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (_req, res) => {
    res.json(banksRepo.getAll());
  });

  router.put('/reorder', (req, res) => {
    const data = reorderSchema.parse(req.body);
    banksRepo.reorder(data);
    res.json({ ok: true });
  });

  router.post('/', (req, res) => {
    const data = bankSchema.parse(req.body);
    const login_url = data.login_url?.trim() || null;
    const result = banksRepo.create(data.name.trim(), login_url);
    res.status(201).json(banksRepo.getById(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = parseIdParam(req);
    const bank = banksRepo.getById(id);
    if (!bank) {
      throw new NotFoundError('bank.not_found');
    }
    const data = bankSchema.parse(req.body);
    const login_url =
      data.login_url === undefined ? bank.login_url : data.login_url?.trim() || null;
    banksRepo.update(id, data.name.trim(), bank.logo, login_url);
    res.json(banksRepo.getById(id));
  });

  router.post('/:id/logo', upload.single('logo'), (req, res) => {
    const id = parseIdParam(req);
    const bank = banksRepo.getById(id);
    if (!bank) {
      throw new NotFoundError('bank.not_found');
    }
    if (!req.file) {
      throw new BadRequestError('bank.no_file');
    }
    banksRepo.update(id, bank.name, `/logos/${req.file.filename}`, bank.login_url);
    res.json(banksRepo.getById(id));
  });

  router.delete('/:id', (req, res) => {
    const id = parseIdParam(req);
    assertFound(banksRepo, id, 'bank.not_found');
    const cnt = accountsRepo.countByBankId(id);
    if (cnt > 0) {
      throw new ConflictError('bank.in_use', { count: cnt });
    }
    banksRepo.delete(id);
    res.json({ ok: true });
  });

  return router;
}
