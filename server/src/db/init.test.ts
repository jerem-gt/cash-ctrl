import { describe, expect, it } from 'vitest';

import { createDb, initDatabase } from './init.js';

interface RefsRow {
  interest_subcategory_id: number | null;
  wire_payment_method_id: number | null;
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

    const userId = (db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number }).id;
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

    // Retour à l'état de la version précédente
    db.exec('ALTER TABLE user_settings DROP COLUMN interest_subcategory_id');
    db.exec('ALTER TABLE user_settings DROP COLUMN wire_payment_method_id');
    db.pragma('user_version = 5');

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

  it('laisse les références à null quand les noms sont introuvables', () => {
    const db = createDb(':memory:');
    initDatabase(db);
    const userId = (db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number }).id;
    db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(userId);

    db.exec('ALTER TABLE user_settings DROP COLUMN interest_subcategory_id');
    db.exec('ALTER TABLE user_settings DROP COLUMN wire_payment_method_id');
    db.pragma('user_version = 5');

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
