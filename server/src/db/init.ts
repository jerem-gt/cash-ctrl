import fs from 'node:fs';
import path from 'node:path';

import Database, { type Database as DatabaseType } from 'better-sqlite3';

import { initSchema } from './schema';
import { seedDatabase } from './seed';

export const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '../../data');

// Each entry converts the DB from version N to N+1.
const MIGRATIONS: Array<(db: DatabaseType) => void> = [
  // v0 → v1: convert monetary REAL columns to INTEGER cents
  (db) => {
    db.exec(`
      UPDATE accounts            SET initial_balance  = ROUND(initial_balance  * 100);
      UPDATE transactions        SET amount           = ROUND(amount           * 100);
      UPDATE transaction_splits  SET amount           = ROUND(amount           * 100);
      UPDATE scheduled_transactions SET amount        = ROUND(amount           * 100);
      UPDATE loans SET
        principal_amount = ROUND(principal_amount * 100),
        monthly_payment  = ROUND(monthly_payment  * 100);
      UPDATE loan_installments SET
        total_amount     = ROUND(total_amount     * 100),
        principal_amount = ROUND(principal_amount * 100),
        interest_amount  = ROUND(interest_amount  * 100);
      UPDATE stock_positions  SET avg_price       = ROUND(avg_price       * 100);
      UPDATE stock_operations SET
        price_per_share  = ROUND(price_per_share  * 100),
        fees             = ROUND(fees             * 100);
      UPDATE stock_prices     SET price           = ROUND(price           * 100);
    `);
  },
  // v1 → v2: revert stock price columns to REAL — cotations avec 4+ décimales (ex. CW8 649.6528)
  // fees reste en centimes (montant fixe)
  (db) => {
    db.exec(`
      UPDATE stock_positions  SET avg_price      = avg_price      / 100.0;
      UPDATE stock_operations SET price_per_share = price_per_share / 100.0;
      UPDATE stock_prices     SET price           = price           / 100.0;
    `);
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
