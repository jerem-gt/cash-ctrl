import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import type Database from 'better-sqlite3';
import type { BankRecord } from '../db.js';
import { requireAuth } from '../middleware.js';
import { LOGOS_DIR } from '../logoDownloader.js';

const schema = z.object({ name: z.string().min(1).max(100) });

const upload = multer({
  storage: multer.diskStorage({
    destination: LOGOS_DIR,
    filename: (req, _file, cb) => cb(null, `bank-${req.params.id}-${Date.now()}.png`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

export function createBanksRouter(db: Database.Database): Router {
  const getBanks    = db.prepare<[], BankRecord & { acc_count: number }>(
    `SELECT b.*, COUNT(a.id) as acc_count FROM banks b LEFT JOIN accounts a ON a.bank_id = b.id GROUP BY b.id ORDER BY b.name`,
  );
  const getBankById = db.prepare<[number], BankRecord>('SELECT * FROM banks WHERE id = ?');
  const insertBank  = db.prepare<[string, string | null]>('INSERT INTO banks (name, logo) VALUES (?, ?)');
  const updateBank  = db.prepare<[string, string | null, number]>('UPDATE banks SET name = ?, logo = ? WHERE id = ?');
  const deleteBank  = db.prepare<[number]>('DELETE FROM banks WHERE id = ?');

  const router = Router();
  router.use(requireAuth);

  router.get('/', (_req, res) => {
    res.json(getBanks.all());
  });

  router.post('/', (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    const result = insertBank.run(parsed.data.name.trim(), null);
    res.status(201).json(getBankById.get(Number(result.lastInsertRowid)));
  });

  router.put('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    const bank = getBankById.get(id);
    if (!bank) { res.status(404).json({ error: 'Bank not found' }); return; }
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    updateBank.run(parsed.data.name.trim(), bank.logo, id);
    res.json(getBankById.get(id));
  });

  router.post('/:id/logo', upload.single('logo'), (req, res) => {
    const id = Number.parseInt(req.params.id as string);
    const bank = getBankById.get(id);
    if (!bank) { res.status(404).json({ error: 'Bank not found' }); return; }
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
    const logoPath = `/logos/${req.file.filename}`;
    updateBank.run(bank.name, logoPath, id);
    res.json(getBankById.get(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number.parseInt(req.params.id);
    if (!getBankById.get(id)) { res.status(404).json({ error: 'Bank not found' }); return; }
    const usage = db.prepare<[number], { cnt: number }>('SELECT COUNT(*) as cnt FROM accounts WHERE bank_id = ?').get(id);
    if (usage && usage.cnt > 0) {
      res.status(409).json({ error: `Cette banque est utilisée par ${usage.cnt} compte(s).` });
      return;
    }
    deleteBank.run(id);
    res.json({ ok: true });
  });

  return router;
}
