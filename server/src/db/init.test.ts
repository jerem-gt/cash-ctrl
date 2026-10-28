import type { Database } from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { createDb, initDatabase } from './init.js';

interface RefsRow {
  interest_subcategory_id: number | null;
  wire_payment_method_id: number | null;
}

function insertUser(db: Database, username = 'alice', isAdmin = 0): number {
  return Number(
    db
      .prepare("INSERT INTO users (username, password_hash, is_admin) VALUES (?, 'x', ?)")
      .run(username, isAdmin).lastInsertRowid,
  );
}

// Retire les colonnes ajoutées par les migrations ≥ version, pour simuler une base plus ancienne.
function rollbackTo(db: Database, version: number) {
  if (version <= 5) {
    db.exec('ALTER TABLE user_settings DROP COLUMN interest_subcategory_id');
    db.exec('ALTER TABLE user_settings DROP COLUMN wire_payment_method_id');
  }
  if (version <= 7) db.exec('ALTER TABLE users DROP COLUMN email');
  db.pragma(`user_version = ${version}`);
}

describe('initDatabase', () => {
  it('une base neuve passe sans migration et expose les colonnes de références', () => {
    const db = createDb(':memory:');
    expect(() => initDatabase(db)).not.toThrow();

    const cols = db.prepare('PRAGMA table_info(user_settings)').all() as Array<{ name: string }>;
    const names = cols.map((c) => c.name);
    expect(names).toContain('interest_subcategory_id');
    expect(names).toContain('wire_payment_method_id');
    expect(db.pragma('user_version', { simple: true })).toBeGreaterThanOrEqual(6);
  });

  it('migre une base v5 : remplit intérêts et virement par nom', () => {
    const db = createDb(':memory:');
    initDatabase(db);

    const userId = insertUser(db);
    const catId = Number(
      db
        .prepare('INSERT INTO categories (user_id, name, icon) VALUES (?, ?, ?)')
        .run(userId, 'Revenus financiers', '📈').lastInsertRowid,
    );
    const otherCatId = Number(
      db
        .prepare('INSERT INTO categories (user_id, name, icon) VALUES (?, ?, ?)')
        .run(userId, 'Autre cat', '❓').lastInsertRowid,
    );
    db.prepare('INSERT INTO subcategories (user_id, name, category_id) VALUES (?, ?, ?)').run(
      userId,
      'Intérêts',
      otherCatId,
    );
    const subId = Number(
      db
        .prepare('INSERT INTO subcategories (user_id, name, category_id) VALUES (?, ?, ?)')
        .run(userId, 'Intérêts', catId).lastInsertRowid,
    );
    const pmId = Number(
      db
        .prepare('INSERT INTO payment_methods (user_id, name) VALUES (?, ?)')
        .run(userId, 'Virement').lastInsertRowid,
    );
    db.prepare(
      'INSERT INTO user_settings (user_id, financial_income_category_id) VALUES (?, ?)',
    ).run(userId, catId);

    rollbackTo(db, 5);

    initDatabase(db);

    const row = db
      .prepare(
        'SELECT interest_subcategory_id, wire_payment_method_id FROM user_settings WHERE user_id = ?',
      )
      .get(userId) as RefsRow;
    expect(row.interest_subcategory_id).toBe(subId);
    expect(row.wire_payment_method_id).toBe(pmId);
    expect(db.pragma('user_version', { simple: true })).toBeGreaterThanOrEqual(6);
  });

  it("migre une base v6 : vide l'historique des cours Yahoo", () => {
    const db = createDb(':memory:');
    initDatabase(db);
    db.prepare(
      "INSERT INTO stock_price_history (ticker, date, price, currency) VALUES ('CW8.PA', '2023-12-31', 10, 'EUR')",
    ).run();
    rollbackTo(db, 6);

    initDatabase(db);

    const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM stock_price_history').get() as {
      cnt: number;
    };
    expect(cnt.cnt).toBe(0);
    expect(db.pragma('user_version', { simple: true })).toBeGreaterThanOrEqual(7);
  });

  it("migre une base v7 : ajoute l'e-mail et donne les données de départ aux admins sans réglages", () => {
    const db = createDb(':memory:');
    initDatabase(db);
    const adminId = insertUser(db, 'root', 1);
    const seededAdminId = insertUser(db, 'root2', 1);
    db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(seededAdminId);
    const userId = insertUser(db, 'bob');

    rollbackTo(db, 7);

    initDatabase(db);

    const cols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    expect(cols.map((c) => c.name)).toContain('email');
    const countFor = (table: string, id: number) =>
      (
        db.prepare(`SELECT COUNT(*) AS cnt FROM ${table} WHERE user_id = ?`).get(id) as {
          cnt: number;
        }
      ).cnt;
    expect(countFor('user_settings', adminId)).toBe(1);
    expect(countFor('categories', adminId)).toBeGreaterThan(0);
    expect(countFor('categories', seededAdminId)).toBe(0);
    expect(countFor('categories', userId)).toBe(0);
    expect(db.pragma('user_version', { simple: true })).toBe(8);
  });

  it('laisse les références à null quand les noms sont introuvables', () => {
    const db = createDb(':memory:');
    initDatabase(db);
    const userId = insertUser(db);
    db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(userId);

    rollbackTo(db, 5);

    initDatabase(db);

    const row = db
      .prepare(
        'SELECT interest_subcategory_id, wire_payment_method_id FROM user_settings WHERE user_id = ?',
      )
      .get(userId) as RefsRow;
    expect(row.interest_subcategory_id).toBeNull();
    expect(row.wire_payment_method_id).toBeNull();
  });
});
