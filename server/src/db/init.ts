import fs from 'node:fs';
import path from 'node:path';

import Database, { type Database as DatabaseType } from 'better-sqlite3';

import { initSchema } from './schema';
import { seedDatabase } from './seed';

export const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '../../data');

// Each entry converts the DB from version N to N+1.
const MIGRATIONS: Array<(db: DatabaseType) => void> = [
  (db) =>
    db.exec(
      'ALTER TABLE reimbursements ADD COLUMN attributed_amount INTEGER CHECK (attributed_amount > 0)',
    ),
  (db) =>
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tx_user_account_date ON transactions(user_id, account_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_tx_user_reimbursement_date ON transactions(user_id, reimbursement_status, date DESC);
      CREATE INDEX IF NOT EXISTS idx_reimbursements_linked ON reimbursements(linked_transaction_id);
      CREATE INDEX IF NOT EXISTS idx_loan_installments_txid ON loan_installments(transaction_id);
    `),
  (db) =>
    db.exec(`
      ALTER TABLE user_settings ADD COLUMN financial_income_category_id  INTEGER;
      ALTER TABLE user_settings ADD COLUMN transfer_subcategory_id       INTEGER;
      ALTER TABLE user_settings ADD COLUMN transfer_payment_method_id    INTEGER;
      ALTER TABLE user_settings ADD COLUMN bank_fees_subcategory_id      INTEGER;
      ALTER TABLE user_settings ADD COLUMN social_fees_subcategory_id    INTEGER;
      ALTER TABLE user_settings ADD COLUMN prelevement_payment_method_id INTEGER;
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
