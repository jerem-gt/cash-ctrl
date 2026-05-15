import type { Database } from 'better-sqlite3';

import { createDb } from '../../db/init';
import { initSchema } from '../../db/schema';
import { seedTaxData } from '../../db/seeds/tax.seed';

// IDs des données seed (stables car AUTOINCREMENT depuis 1 à chaque DB fraîche)
export const SEED = {
  BANK_ID: 1, // 'DefaultBank'
  AT_COURANT: 1, // 'Courant'
  AT_EPARGNE: 2, // 'Épargne'
  AT_BOURSE: 3, // 'Bourse'
  AT_AV: 4, // 'Assurance Vie'
  AT_PER: 5, // 'PER'
  SUBCAT_AUTRE: 1,
  SUBCAT_SALAIRE: 2,
  SUBCAT_SUPERMARCHE: 3,
  SUBCAT_CINEMA: 4,
  SUBCAT_LOYER: 5,
  SUBCAT_TRANSFERT: 6,
  PM_VIREMENT: 1,
  PM_CARTE: 2,
  PM_TRANSFERT: 3,
} as const;

export function seedTestReferenceData(db: Database, userId: number) {
  db.prepare('INSERT OR IGNORE INTO banks (name) VALUES (?)').run('DefaultBank');

  db.prepare('INSERT INTO account_types (user_id, name) VALUES (?, ?)').run(userId, 'Courant');
  db.prepare('INSERT INTO account_types (user_id, name) VALUES (?, ?)').run(userId, 'Épargne');
  db.prepare('INSERT INTO account_types (user_id, name, envelope_type) VALUES (?, ?, ?)').run(
    userId,
    'Bourse',
    'investment',
  );
  db.prepare('INSERT INTO account_types (user_id, name, envelope_type) VALUES (?, ?, ?)').run(
    userId,
    'Assurance Vie',
    'life_insurance',
  );
  db.prepare('INSERT INTO account_types (user_id, name, envelope_type) VALUES (?, ?, ?)').run(
    userId,
    'PER',
    'per',
  );

  db.prepare('INSERT INTO categories (user_id, name, icon) VALUES (?, ?, ?)').run(
    userId,
    'Revenus divers',
    '💰',
  );
  db.prepare('INSERT INTO categories (user_id, name, icon) VALUES (?, ?, ?)').run(
    userId,
    'Revenus du travail',
    '💼',
  );
  db.prepare('INSERT INTO categories (user_id, name, icon) VALUES (?, ?, ?)').run(
    userId,
    'Alimentation',
    '🍴',
  );
  db.prepare('INSERT INTO categories (user_id, name, icon) VALUES (?, ?, ?)').run(
    userId,
    'Loisirs',
    '🎮',
  );
  db.prepare('INSERT INTO categories (user_id, name, icon) VALUES (?, ?, ?)').run(
    userId,
    'Logement',
    '🏠',
  );
  db.prepare('INSERT INTO categories (user_id, name, icon) VALUES (?, ?, ?)').run(
    userId,
    'Transfert',
    '🔄',
  );

  db.prepare('INSERT INTO subcategories (user_id, name, category_id) VALUES (?, ?, ?)').run(
    userId,
    'Autre',
    1,
  );
  db.prepare('INSERT INTO subcategories (user_id, name, category_id) VALUES (?, ?, ?)').run(
    userId,
    'Salaire',
    2,
  );
  db.prepare('INSERT INTO subcategories (user_id, name, category_id) VALUES (?, ?, ?)').run(
    userId,
    'Supermarché',
    3,
  );
  db.prepare('INSERT INTO subcategories (user_id, name, category_id) VALUES (?, ?, ?)').run(
    userId,
    'Cinéma',
    4,
  );
  db.prepare('INSERT INTO subcategories (user_id, name, category_id) VALUES (?, ?, ?)').run(
    userId,
    'Loyer',
    5,
  );
  db.prepare('INSERT INTO subcategories (user_id, name, category_id) VALUES (?, ?, ?)').run(
    userId,
    'Transfert',
    6,
  );

  db.prepare('INSERT INTO payment_methods (user_id, name) VALUES (?, ?)').run(userId, 'Virement');
  db.prepare('INSERT INTO payment_methods (user_id, name) VALUES (?, ?)').run(
    userId,
    'Carte Bancaire',
  );
  db.prepare('INSERT INTO payment_methods (user_id, name) VALUES (?, ?)').run(userId, 'Transfert');
}

export function createTestDb(): Database {
  const db = createDb(':memory:');
  initSchema(db);
  db.prepare('INSERT INTO banks (name) VALUES (?)').run('DefaultBank');
  seedTaxData(db);
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
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('test', 'x')
      .lastInsertRowid,
  );
  seedTestReferenceData(db, userId);

  const accountId = Number(
    db
      .prepare(
        'INSERT INTO accounts (user_id, name, bank_id, account_type_id, opening_date) VALUES (?, ?, ?, ?, ?)',
      )
      .run(userId, 'Compte principal', SEED.BANK_ID, SEED.AT_COURANT, '2020-01-01').lastInsertRowid,
  );
  const account2Id = Number(
    db
      .prepare(
        'INSERT INTO accounts (user_id, name, bank_id, account_type_id, opening_date) VALUES (?, ?, ?, ?, ?)',
      )
      .run(userId, 'Épargne', SEED.BANK_ID, SEED.AT_EPARGNE, '2021-06-01').lastInsertRowid,
  );

  return { db, userId, accountId, account2Id };
}
