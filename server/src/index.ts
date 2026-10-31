import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';

import { announceSetupToken, SetupToken } from '@jerem-gt/ctrl-shared/server/setup';
import express from 'express';

import { createApp } from './app.js';
import { createDb, initDatabase } from './db/init.js';
import { startBackupInterval } from './lib/backup.js';
import { startScheduledGenerationInterval } from './lib/generateScheduled.js';
import { logger } from './logger.js';
import { downloadDefaultBankLogos, LOGOS_DIR } from './logoDownloader.js';
import { startPriceRefreshInterval } from './modules/stocks/stocks.service.js';

const PORT = Number.parseInt(process.env.PORT ?? '3000');
const IS_PROD = process.env.NODE_ENV === 'production';
const SESSION_SECRET =
  process.env.SESSION_SECRET ??
  (process.env.NODE_ENV === 'development' ? 'dev-secret-not-for-production' : undefined);

if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set (only NODE_ENV=development allows a default secret)');
}

const db = createDb();
initDatabase(db);
const CLIENT_DIST = path.join(import.meta.dirname, '../../client/dist');

if (process.env.ADMIN_USER || process.env.ADMIN_PASSWORD) {
  logger.warn(
    'ADMIN_USER / ADMIN_PASSWORD sont des variables obsolètes, ignorées : les comptes se gèrent dans l’application.',
  );
}

const setupToken = new SetupToken();
announceSetupToken(db, setupToken, logger.info);

const app = createApp(db, {
  setupToken,
  sessionSecret: SESSION_SECRET,
  secureCookies: process.env.SECURE_COOKIE === 'true',
  healthExtraCheck: IS_PROD
    ? () => (fs.existsSync(path.join(CLIENT_DIST, 'index.html')) ? null : 'frontend')
    : undefined,
});

app.set('trust proxy', 1);
// Logos de banques : noms stables, changent rarement → cache navigateur d'une journée
app.use('/logos', express.static(LOGOS_DIR, { maxAge: '1d' }));

if (IS_PROD) {
  // Seuls les fichiers de assets/ ont une empreinte dans leur nom : cache immuable 1 an. Les autres
  // (index.html, sw.js, manifestes…) gardent leur nom d'un déploiement à l'autre : revalidés à
  // chaque requête (ETag, 304 s'ils n'ont pas changé).
  app.use(
    express.static(CLIENT_DIST, {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (path.relative(CLIENT_DIST, filePath).split(path.sep)[0] !== 'assets') {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );

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

const server = app.listen(PORT, '0.0.0.0', () => {
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

function shutdown(signal: string) {
  logger.info(`${signal} — shutting down`);
  server.close(() => {
    // Checkpoint WAL avant fermeture : réduit le travail de recovery au prochain démarrage.
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
    logger.info('DB checkpoint and close complete');
    process.exit(0);
  });
  // Forcer la sortie si des requêtes bloquent trop longtemps.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
