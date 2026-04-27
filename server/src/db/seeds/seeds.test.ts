import type { Database } from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { createDb } from '../init.js';
import { initSchema } from '../schema.js';
import { seedDatabase } from '../seed.js';
import { seedAccountTypes } from './accountTypes.seed.js';
import { seedBanks } from './banks.seed.js';
import { seedCategories } from './categories.seed.js';
import { DEFAULT_PAYMENT_METHODS, seedPaymentMethods } from './paymentMethods.seed.js';
import { seedSubcategories } from './subcategories.seed';
import { seedAdminUser } from './users.seed.js';

function createFreshDb(): Database {
  const db = createDb(':memory:');
  initSchema(db);
  return db;
}

describe('seedBanks', () => {
  it('inserts 9 banks with name and domain coherent with the schema', () => {
    const db = createFreshDb();
    seedBanks(db);
    const rows = db.prepare('SELECT name, domain FROM banks ORDER BY name').all() as {
      name: string;
      domain: string;
    }[];
    expect(rows).toHaveLength(9);
    expect(rows.every((r) => r.name && r.domain)).toBe(true);
  });

  it('is idempotent – INSERT OR IGNORE prevents duplicates', () => {
    const db = createFreshDb();
    seedBanks(db);
    seedBanks(db);
    const count = (db.prepare('SELECT COUNT(*) as c FROM banks').get() as { c: number }).c;
    expect(count).toBe(9);
  });
});

describe('seedAccountTypes', () => {
  it('inserts 5 account types coherent with the schema', () => {
    const db = createFreshDb();
    seedAccountTypes(db);
    const rows = db.prepare('SELECT name FROM account_types').all() as { name: string }[];
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.name)).toContain('Courant');
    expect(rows.map((r) => r.name)).toContain('Épargne');
  });

  it('is idempotent – INSERT OR IGNORE prevents duplicates', () => {
    const db = createFreshDb();
    seedAccountTypes(db);
    seedAccountTypes(db);
    const count = (db.prepare('SELECT COUNT(*) as c FROM account_types').get() as { c: number }).c;
    expect(count).toBe(5);
  });
});

describe('seedCategories', () => {
  it('inserts 10 categories with valid name and color coherent with the schema', () => {
    const db = createFreshDb();
    seedCategories(db);
    const rows = db.prepare('SELECT name, color FROM categories').all() as {
      name: string;
      color: string;
    }[];
    expect(rows).toHaveLength(14);
    expect(rows.every((r) => r.name && /^#[0-9A-Fa-f]{6}$/.test(r.color))).toBe(true);
  });
});

describe('seedSubcategories', () => {
  it('inserts 10 subcategories with valid name and category_id coherent with the schema', () => {
    const db = createFreshDb();
    seedCategories(db);
    seedSubcategories(db);
    const rows = db.prepare('SELECT name, category_id FROM subcategories').all() as {
      name: string;
      category_id: string;
    }[];
    expect(rows).toHaveLength(64);
    expect(rows.every((r) => r.name && r.category_id)).toBe(true);
  });
});

describe('seedPaymentMethods', () => {
  it('inserts 5 payment methods with name and icon coherent with the schema', () => {
    const db = createFreshDb();
    seedPaymentMethods(db);
    const rows = db.prepare('SELECT name, icon FROM payment_methods').all() as {
      name: string;
      icon: string;
    }[];
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.name)).toBe(true);
  });

  it('is idempotent – INSERT OR IGNORE prevents duplicates', () => {
    const db = createFreshDb();
    seedPaymentMethods(db);
    seedPaymentMethods(db);
    const count = (db.prepare('SELECT COUNT(*) as c FROM payment_methods').get() as { c: number })
      .c;
    expect(count).toBe(DEFAULT_PAYMENT_METHODS.length);
  });
});

describe('seedAdminUser', () => {
  it('creates an admin user with default credentials', () => {
    const db = createFreshDb();
    seedAdminUser(db);
    const user = db.prepare('SELECT username FROM users WHERE username = ?').get('admin') as
      | { username: string }
      | undefined;
    expect(user?.username).toBe('admin');
  });

  it('uses ADMIN_USER / ADMIN_PASSWORD env vars when set', () => {
    const db = createFreshDb();
    process.env.ADMIN_USER = 'superadmin';
    process.env.ADMIN_PASSWORD = 'S3cret!';
    try {
      seedAdminUser(db);
      const user = db.prepare('SELECT username FROM users WHERE username = ?').get('superadmin') as
        | { username: string }
        | undefined;
      expect(user?.username).toBe('superadmin');
    } finally {
      delete process.env.ADMIN_USER;
      delete process.env.ADMIN_PASSWORD;
    }
  });

  it('is idempotent – does not create a duplicate user on second call', () => {
    const db = createFreshDb();
    seedAdminUser(db);
    seedAdminUser(db);
    const count = (
      db.prepare('SELECT COUNT(*) as c FROM users WHERE username = ?').get('admin') as { c: number }
    ).c;
    expect(count).toBe(1);
  });
});

describe('seedDatabase', () => {
  it('seeds all reference tables', () => {
    const db = createFreshDb();
    seedDatabase(db);
    const q = (table: string) =>
      (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
    expect(q('banks')).toBeGreaterThan(0);
    expect(q('account_types')).toBeGreaterThan(0);
    expect(q('categories')).toBeGreaterThan(0);
    expect(q('payment_methods')).toBeGreaterThan(0);
    expect(
      (
        db.prepare("SELECT COUNT(*) as c FROM users WHERE username = 'admin'").get() as {
          c: number;
        }
      ).c,
    ).toBe(1);
  });
});
