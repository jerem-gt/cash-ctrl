import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { parseBody, parseNumberParam, requireById, sendError } from '../../lib/routeHelpers';
import { nameSchema } from '../../lib/validators';
import { LOGOS_DIR } from '../../logoDownloader.js';
import { requireAuth } from '../../middleware.js';
import { createAccountsRepo } from '../accounts/accounts.repo';
import { createBanksRepo } from './banks.repo';

const bankSchema = z.object({
  name: nameSchema,
  domain: z.string().max(253).nullable().optional(),
});

const reorderSchema = z.array(z.object({ id: z.number().int(), sort_order: z.number().int() }));

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
    const data = parseBody(res, reorderSchema, req.body);
    if (!data) return;
    banksRepo.reorder(data);
    res.json({ ok: true });
  });

  router.post('/', (req, res) => {
    const data = parseBody(res, bankSchema, req.body);
    if (!data) return;
    const domain = data.domain?.trim() || null;
    const result = banksRepo.create(data.name.trim(), domain);
    res.status(201).json(banksRepo.getById(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const bank = banksRepo.getById(id);
    if (!bank) {
      sendError(res, 404, 'bank.not_found');
      return;
    }
    const data = parseBody(res, bankSchema, req.body);
    if (!data) return;
    const domain = data.domain === undefined ? bank.domain : data.domain?.trim() || null;
    banksRepo.update(id, data.name.trim(), bank.logo, domain);
    res.json(banksRepo.getById(id));
  });

  router.post('/:id/logo', upload.single('logo'), (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    const bank = banksRepo.getById(id);
    if (!bank) {
      sendError(res, 404, 'bank.not_found');
      return;
    }
    if (!req.file) {
      sendError(res, 400, 'bank.no_file');
      return;
    }
    banksRepo.update(id, bank.name, `/logos/${req.file.filename}`, bank.domain);
    res.json(banksRepo.getById(id));
  });

  router.delete('/:id', (req, res) => {
    const id = parseNumberParam(req, res, 'id');
    if (id === null) return;
    if (!requireById(res, banksRepo, id, 'bank.not_found')) return;
    const cnt = accountsRepo.countByBankId(id);
    if (cnt > 0) {
      sendError(res, 409, 'bank.in_use', { count: cnt });
      return;
    }
    banksRepo.delete(id);
    res.json({ ok: true });
  });

  return router;
}
