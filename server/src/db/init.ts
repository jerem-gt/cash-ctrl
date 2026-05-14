import fs from 'node:fs';
import path from 'node:path';

import Database, { type Database as DatabaseType } from 'better-sqlite3';

import { initSchema } from './schema';
import { seedDatabase } from './seed';

export const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '../../data');

// Each entry converts the DB from version N to N+1.
const MIGRATIONS: Array<(db: DatabaseType) => void> = [
  // v0 → v1 : rebuild stock_operations — nullable transaction_id, new types, transfer_peer_id
  (db) => {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE stock_operations_new (
          id                  INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          account_id          INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          transaction_id      INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
          fees_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
          ticker              TEXT NOT NULL,
          type                TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'transfer_in', 'transfer_out')),
          quantity            REAL NOT NULL,
          price_per_share     REAL NOT NULL,
          fees                INTEGER NOT NULL DEFAULT 0,
          date                TEXT NOT NULL,
          transfer_peer_id    INTEGER REFERENCES stock_operations_new(id) ON DELETE SET NULL,
          created_at          TEXT DEFAULT (datetime('now'))
        )
      `);
      db.exec(`
        INSERT INTO stock_operations_new
          (id, user_id, account_id, transaction_id, fees_transaction_id, ticker, type, quantity, price_per_share, fees, date, transfer_peer_id, created_at)
        SELECT id, user_id, account_id, transaction_id, fees_transaction_id, ticker, type, quantity, price_per_share, fees, date, NULL, created_at
        FROM stock_operations
      `);
      db.exec('DROP TRIGGER IF EXISTS stock_op_fees_cleanup');
      db.exec('DROP TABLE stock_operations');
      db.exec('ALTER TABLE stock_operations_new RENAME TO stock_operations');
      db.exec('CREATE INDEX idx_stock_txid ON stock_operations(transaction_id)');
      db.exec('CREATE INDEX idx_stock_ops_account_ticker ON stock_operations(account_id, ticker)');
      db.exec(`
        CREATE TRIGGER stock_op_fees_cleanup
        AFTER DELETE ON stock_operations
        WHEN OLD.fees_transaction_id IS NOT NULL
        BEGIN
          DELETE FROM transactions WHERE id = OLD.fees_transaction_id;
        END
      `);
    })();
  },

  // v1 → v2 : add backup settings columns to user_settings
  (db) => {
    db.exec(`ALTER TABLE user_settings ADD COLUMN backup_enabled     INTEGER NOT NULL DEFAULT 0`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN backup_frequency_h INTEGER NOT NULL DEFAULT 24`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN backup_max_files   INTEGER NOT NULL DEFAULT 7`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN backup_last_at     TEXT`);
  },

  // v2 → v3 : add backup_last_hash for change-detection
  (db) => {
    db.exec(`ALTER TABLE user_settings ADD COLUMN backup_last_hash TEXT`);
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
  initSchema(db);
  seedDatabase(db);
  runMigrations(db);
}
