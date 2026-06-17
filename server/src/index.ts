import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';

import express from 'express';

import { createApp } from './app.js';
import { createDb, initDatabase } from './db/init';
import { startBackupInterval } from './lib/backup.js';
import { startScheduledGenerationInterval } from './lib/generateScheduled.js';
import { logger } from './logger';
import { downloadDefaultBankLogos, LOGOS_DIR } from './logoDownloader.js';
import { startPriceRefreshInterval } from './modules/stocks/stocks.service.js';

const PORT = Number.parseInt(process.env.PORT ?? '3000');
const SESSION_SECRET = process.env.SESSION_SECRET ?? 'dev-secret-change-in-production';
const IS_PROD = process.env.NODE_ENV === 'production';

if (IS_PROD && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production');
}

const db = createDb();
initDatabase(db);
const app = createApp(db, {
  sessionSecret: SESSION_SECRET,
  secureCookies: process.env.SECURE_COOKIE === 'true',
});

app.set('trust proxy', 1);
// Logos de banques : noms stables, changent rarement → cache navigateur d'une journée
app.use('/logos', express.static(LOGOS_DIR, { maxAge: '1d' }));

const CLIENT_DIST = path.join(__dirname, '../../client/dist');

if (IS_PROD) {
  // Assets Vite à noms hashés → cache immuable 1 an ; index.html ne doit jamais être caché
  app.use(
    express.static(CLIENT_DIST, {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );

  // Override health check in production to also verify the frontend bundle
  app.get('/api/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
    } catch {
      res.status(503).json({ ok: false, reason: 'db' });
      return;
    }
    if (!fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
      res.status(503).json({ ok: false, reason: 'frontend' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('*splat', (_req, res) =>
    res.sendFile(path.join(CLIENT_DIST, 'index.html'), {
      headers: { 'Cache-Control': 'no-cache' },
    }),
  );
}

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${String(reason)}`);
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(
    `Server running on http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'})`,
  );
  downloadDefaultBankLogos(db).catch((err: unknown) => {
    logger.error(String(err));
  });
  startPriceRefreshInterval(db);
  startBackupInterval(db);
  startScheduledGenerationInterval(db);
});
