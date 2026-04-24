import type { Database } from 'better-sqlite3';

import { createDb } from '../../db/init';
import { initSchema } from '../../db/schema';

// IDs des données seed (stables car AUTOINCREMENT depuis 1)
export const SEED = {
  BANK_ID:          1, // 'DefaultBank'
  AT_COURANT:       1, // 'Courant'
  AT_EPARGNE:       2, // 'Épargne'
  CAT_AUTRE:        1,
  CAT_SALAIRE:      2,
  CAT_ALIMENTATION: 3,
  CAT_LOISIRS:      4,
  CAT_LOYER:        5,
  CAT_TRANSFERT:    6,
  PM_VIREMENT:      1,
  PM_CARTE:         2,
  PM_TRANSFERT:     3,
} as const;

export function seedTestReferenceData(db: Database) {
  db.exec(`
    INSERT INTO banks (name) VALUES ('DefaultBank');
    INSERT INTO account_types (name) VALUES ('Courant'), ('Épargne');
    INSERT INTO categories (name) VALUES
      ('Autre'), ('Salaire'), ('Alimentation'), ('Loisirs'), ('Loyer'), ('Transfert');
    INSERT INTO payment_methods (name) VALUES
      ('Virement'), ('Carte Bancaire'), ('Transfert');
  `);
}

export function createTestDb(): Database {
  const db = createDb(':memory:');
  initSchema(db);
  seedTestReferenceData(db);
  return db;
}

export interface Fixtures {
  db: Database;
  userId: number;
  accountId: number;
  account2Id: number;
}

export function setupFixtures(): Fixtures {
  const db = createTestDb();

  const userId = Number(
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('test', 'x').lastInsertRowid,
  );
  const accountId = Number(
    db.prepare('INSERT INTO accounts (user_id, name, bank_id, account_type_id, opening_date) VALUES (?, ?, ?, ?, ?)')
      .run(userId, 'Compte principal', SEED.BANK_ID, SEED.AT_COURANT, '2020-01-01').lastInsertRowid,
  );
  const account2Id = Number(
    db.prepare('INSERT INTO accounts (user_id, name, bank_id, account_type_id, opening_date) VALUES (?, ?, ?, ?, ?)')
      .run(userId, 'Épargne', SEED.BANK_ID, SEED.AT_EPARGNE, '2021-06-01').lastInsertRowid,
  );

  return { db, userId, accountId, account2Id };
}
