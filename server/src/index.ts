import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';

import express from 'express';

import { createApp } from './app.js';
import { createDb, initDatabase } from './db/init';
import { downloadDefaultBankLogos, LOGOS_DIR } from './logoDownloader.js';

const PORT           = Number.parseInt(process.env.PORT ?? '3000');
const SESSION_SECRET = process.env.SESSION_SECRET ?? 'dev-secret-change-in-production';
const IS_PROD        = process.env.NODE_ENV === 'production';

const db = createDb();
initDatabase(db);
const app = createApp(db, {
  sessionSecret: SESSION_SECRET,
  secureCookies: process.env.SECURE_COOKIE === 'true',
});

app.set('trust proxy', 1);
app.use('/logos', express.static(LOGOS_DIR));

if (IS_PROD) {
  app.use(express.static(path.join(__dirname, '../../client/dist')));

  // Override health check in production to also verify the frontend bundle
  app.get('/api/health', (_req, res) => {
    try { db.prepare('SELECT 1').get(); } catch {
      res.status(503).json({ ok: false, reason: 'db' }); return;
    }
    if (!fs.existsSync(path.join(__dirname, '../../client/dist', 'index.html'))) {
      res.status(503).json({ ok: false, reason: 'frontend' }); return;
    }
    res.json({ ok: true });
  });

  app.get('*splat', (_req, res) => res.sendFile(path.join(__dirname, '../../client/dist', 'index.html')));
}

app.listen(PORT, '0.0.0.0', () => {
  process.stdout.write(`[cashctrl] Server running on http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'})\n`);
  downloadDefaultBankLogos(db).catch((err: unknown) => { process.stderr.write(`${String(err)}\n`); });
});
