import fs from 'node:fs';
import path from 'node:path';

import Database, { type Database as DatabaseType } from 'better-sqlite3';

import { initSchema } from './schema';
import { seedDatabase } from './seed';

export const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '../../data');

// Each entry converts the DB from version N to N+1.
const MIGRATIONS: Array<(db: DatabaseType) => void> = [
  (db) =>
    db.exec(`
      UPDATE transactions
      SET
        subcategory_id    = COALESCE(subcategory_id,    (SELECT us.transfer_subcategory_id    FROM user_settings us WHERE us.user_id = transactions.user_id)),
        payment_method_id = COALESCE(payment_method_id, (SELECT us.transfer_payment_method_id FROM user_settings us WHERE us.user_id = transactions.user_id))
      WHERE id IN (SELECT transaction_id FROM insurance_operations WHERE transaction_id IS NOT NULL)
        AND (subcategory_id IS NULL OR payment_method_id IS NULL);
    `),
];

function runMigrations(db: DatabaseType) {
  const version = db.pragma('user_version', { simple: true }) as number;
  for (let i = version; i < MIGRATIONS.length; i++) {
    MIGRATIONS[i](db);
    db.pragma(`user_version = ${i + 1}`);
  }
}

export function createDb(filePath?: string) {
  const isMemory = filePath === ':memory:';

  const DB_PATH = filePath ?? path.join(DATA_DIR, 'cashctrl.db');

  // 👉 création dossier seulement si DB fichier
  if (!isMemory) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(DB_PATH);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  // Réglages de robustesse/perf, surtout utiles sur stockage lent ou concurrent
  // (sur SSD local le gain est négligeable, mais ces réglages sont sûrs avec WAL) :
  db.pragma('synchronous = NORMAL'); // pas de fsync par commit (durabilité garantie au checkpoint)
  db.pragma('busy_timeout = 5000'); // attend au lieu de renvoyer SQLITE_BUSY
  db.pragma('cache_size = -16000'); // 16 Mo de cache pages
  db.pragma('temp_store = MEMORY'); // tables temporaires (GROUP BY/ORDER BY) en RAM
  db.pragma('mmap_size = 268435456'); // I/O mappée en mémoire (256 Mo)

  return db;
}

export function initDatabase(db: DatabaseType) {
  const isFresh = !db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    .get();

  initSchema(db);
  seedDatabase(db);

  if (isFresh) {
    // Fresh DB: schema already includes all columns — skip migrations
    db.pragma(`user_version = ${MIGRATIONS.length}`);
  } else {
    runMigrations(db);
  }
}
