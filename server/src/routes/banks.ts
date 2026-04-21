import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import { queries } from '../db.js';
import { requireAuth } from '../middleware.js';
import { LOGOS_DIR } from '../logoDownloader.js';

export const banksRouter = Router();
banksRouter.use(requireAuth);

const schema = z.object({ name: z.string().min(1).max(100) });

const upload = multer({
  storage: multer.diskStorage({
    destination: LOGOS_DIR,
    filename: (req, _file, cb) => cb(null, `bank-${req.params.id}-${Date.now()}.png`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

banksRouter.get('/', (_req, res) => {
  res.json(queries.getBanks.all());
});

banksRouter.post('/', (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const result = queries.insertBank.run(parsed.data.name.trim(), null);
  res.status(201).json(queries.getBankById.get(Number(result.lastInsertRowid)));
});

banksRouter.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const bank = queries.getBankById.get(id);
  if (!bank) { res.status(404).json({ error: 'Bank not found' }); return; }
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  queries.updateBank.run(parsed.data.name.trim(), bank.logo, id);
  res.json(queries.getBankById.get(id));
});

banksRouter.post('/:id/logo', upload.single('logo'), (req, res) => {
  const id = parseInt(req.params.id as string);
  const bank = queries.getBankById.get(id);
  if (!bank) { res.status(404).json({ error: 'Bank not found' }); return; }
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
  const logoPath = `/logos/${req.file.filename}`;
  queries.updateBank.run(bank.name, logoPath, id);
  res.json(queries.getBankById.get(id));
});

banksRouter.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!queries.getBankById.get(id)) { res.status(404).json({ error: 'Bank not found' }); return; }
  queries.deleteBank.run(id);
  res.json({ ok: true });
});
