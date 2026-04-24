import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { requireAuth } from '../../middleware.js';
import { LOGOS_DIR } from '../../logoDownloader.js';
import type { Database } from 'better-sqlite3';
import { createBanksRepo } from './banks.repo';

const schema = z.object({ name: z.string().min(1).max(100) });

const upload = multer({
  storage: multer.diskStorage({
    destination: LOGOS_DIR,
    filename: (req, _file, cb) => cb(null, `bank-${req.params.id}-${Date.now()}.png`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

export function createBanksRouter(db: Database): Router {
  const banksRepo = createBanksRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (_req, res) => {
    res.json(banksRepo.getAll());
  });

  router.post('/', (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    const result = banksRepo.create(parsed.data.name.trim());
    res.status(201).json(banksRepo.getById(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const bank = banksRepo.getById(id);
    if (!bank) { res.status(404).json({ error: 'Bank not found' }); return; }
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    banksRepo.update(id, parsed.data.name.trim(), bank.logo);
    res.json(banksRepo.getById(id));
  });

  router.post('/:id/logo', upload.single('logo'), (req, res) => {
    const id = Number.parseInt(req.params.id as string);
    const bank = banksRepo.getById(id);
    if (!bank) { res.status(404).json({ error: 'Bank not found' }); return; }
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
    banksRepo.update(id, bank.name, `/logos/${req.file.filename}`);
    res.json(banksRepo.getById(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!banksRepo.getById(id)) { res.status(404).json({ error: 'Bank not found' }); return; }
    const cnt = banksRepo.getAccountCount(id);
    if (cnt > 0) {
      res.status(409).json({ error: `Cette banque est utilisée par ${cnt} compte(s).` });
      return;
    }
    banksRepo.delete(id);
    res.json({ ok: true });
  });

  return router;
}
