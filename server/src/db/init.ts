import fs from 'node:fs';
import path from 'node:path';

import Database, { type Database as DatabaseType } from 'better-sqlite3';

import { initSchema } from './schema';
import { seedDatabase } from './seed';

export const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '../../data');

// Each entry converts the DB from version N to N+1.
const MIGRATIONS: Array<(db: DatabaseType) => void> = [
  // 0: sort_order on banks
  (db) => {
    const cols = (db.pragma('table_info(banks)') as { name: string }[]).map((r) => r.name);
    if (!cols.includes('sort_order')) {
      db.exec('ALTER TABLE banks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
      db.exec(
        'UPDATE banks SET sort_order = (SELECT COUNT(*) FROM banks b2 WHERE b2.name < banks.name)',
      );
    }
  },
  // 1: insurance_support_id + insurance_fees on scheduled_transactions
  (db) => {
    const cols = new Set(
      (db.pragma('table_info(scheduled_transactions)') as { name: string }[]).map((r) => r.name),
    );
    if (!cols.has('insurance_support_id')) {
      db.exec(
        'ALTER TABLE scheduled_transactions ADD COLUMN insurance_support_id INTEGER REFERENCES insurance_supports(id) ON DELETE SET NULL',
      );
    }
    if (!cols.has('insurance_fees')) {
      db.exec(
        'ALTER TABLE scheduled_transactions ADD COLUMN insurance_fees INTEGER NOT NULL DEFAULT 0',
      );
    }
  },
  // 2: social_fees + social_fees_transaction_id on insurance_operations
  (db) => {
    const cols = new Set(
      (db.pragma('table_info(insurance_operations)') as { name: string }[]).map((r) => r.name),
    );
    if (!cols.has('social_fees')) {
      db.exec('ALTER TABLE insurance_operations ADD COLUMN social_fees INTEGER NOT NULL DEFAULT 0');
    }
    if (!cols.has('social_fees_transaction_id')) {
      db.exec(
        'ALTER TABLE insurance_operations ADD COLUMN social_fees_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL',
      );
    }
  },
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
