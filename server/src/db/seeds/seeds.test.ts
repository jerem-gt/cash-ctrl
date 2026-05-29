import type { Database } from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { createDb } from '../init.js';
import { initSchema } from '../schema.js';
import { seedDatabase, seedUserData } from '../seed.js';
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
  it('inserts 18 banks with name coherent with the schema', () => {
    const db = createFreshDb();
    seedBanks(db);
    const rows = db.prepare('SELECT name, domain FROM banks ORDER BY name').all() as {
      name: string;
      domain: string;
    }[];
    expect(rows).toHaveLength(18);
    expect(rows.every((r) => r.name)).toBe(true);
  });

  it('is idempotent – INSERT OR IGNORE prevents duplicates', () => {
    const db = createFreshDb();
    seedBanks(db);
    seedBanks(db);
    const count = (db.prepare('SELECT COUNT(*) as c FROM banks').get() as { c: number }).c;
    expect(count).toBe(18);
  });
});

describe('seedAccountTypes', () => {
  it('inserts account types coherent with the schema', () => {
    const db = createFreshDb();
    seedAdminUser(db);
    const { id } = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number };
    seedAccountTypes(db, id);
    const rows = db.prepare('SELECT name FROM account_types').all() as { name: string }[];
    expect(rows).toHaveLength(7);
    expect(rows.map((r) => r.name)).toContain('Courant');
    expect(rows.map((r) => r.name)).toContain('Épargne');
    expect(rows.map((r) => r.name)).toContain('Prêt');
    expect(rows.map((r) => r.name)).toContain('Assurance Vie');
    expect(rows.map((r) => r.name)).toContain('PER');
  });

  it('inserts English account types when lang=en', () => {
    const db = createFreshDb();
    seedAdminUser(db);
    const { id } = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number };
    seedAccountTypes(db, id, 'en');
    const rows = db.prepare('SELECT name FROM account_types').all() as { name: string }[];
    expect(rows.map((r) => r.name)).toContain('Checking');
    expect(rows.map((r) => r.name)).toContain('Savings');
    expect(rows.map((r) => r.name)).toContain('Loan');
    expect(rows.map((r) => r.name)).toContain('Life insurance');
    expect(rows.map((r) => r.name)).toContain('Brokerage');
  });

  it('is idempotent – INSERT OR IGNORE prevents duplicates', () => {
    const db = createFreshDb();
    seedAdminUser(db);
    const { id } = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number };
    seedAccountTypes(db, id);
    seedAccountTypes(db, id);
    const count = (db.prepare('SELECT COUNT(*) as c FROM account_types').get() as { c: number }).c;
    expect(count).toBe(7);
  });
});

describe('seedCategories', () => {
  it('inserts 14 categories with valid name coherent with the schema', () => {
    const db = createFreshDb();
    seedAdminUser(db);
    const { id } = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number };
    seedCategories(db, id);
    const rows = db.prepare('SELECT name FROM categories').all() as {
      name: string;
    }[];
    expect(rows).toHaveLength(14);
    expect(rows.every((r) => r.name)).toBe(true);
  });

  it('inserts English category names when lang=en', () => {
    const db = createFreshDb();
    seedAdminUser(db);
    const { id } = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number };
    seedCategories(db, id, 'en');
    const rows = db.prepare('SELECT name FROM categories').all() as { name: string }[];
    expect(rows.map((r) => r.name)).toContain('Financial income');
    expect(rows.map((r) => r.name)).toContain('Housing');
    expect(rows.map((r) => r.name)).toContain('Food');
    expect(rows.map((r) => r.name)).toContain('Transfer');
  });
});

describe('seedSubcategories', () => {
  it('inserts 71 subcategories with valid name and category_id coherent with the schema', () => {
    const db = createFreshDb();
    seedAdminUser(db);
    const { id } = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number };
    seedCategories(db, id);
    seedSubcategories(db, id);
    const rows = db.prepare('SELECT name, category_id FROM subcategories').all() as {
      name: string;
      category_id: string;
    }[];
    expect(rows).toHaveLength(71);
    expect(rows.every((r) => r.name && r.category_id)).toBe(true);
  });

  it('inserts English subcategory names when lang=en', () => {
    const db = createFreshDb();
    seedAdminUser(db);
    const { id } = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number };
    const catMap = seedCategories(db, id, 'en');
    seedSubcategories(db, id, 'en', catMap);
    const rows = db.prepare('SELECT name FROM subcategories').all() as { name: string }[];
    expect(rows.map((r) => r.name)).toContain('Bank fees');
    expect(rows.map((r) => r.name)).toContain('Salary');
    expect(rows.map((r) => r.name)).toContain('Interest');
    expect(rows.map((r) => r.name)).toContain('Transfer');
    expect(rows.map((r) => r.name)).toContain('Social charges');
  });
});

describe('seedPaymentMethods', () => {
  it('inserts 6 payment methods with name and icon coherent with the schema', () => {
    const db = createFreshDb();
    seedAdminUser(db);
    const { id } = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number };
    seedPaymentMethods(db, id);
    const rows = db.prepare('SELECT name, icon FROM payment_methods').all() as {
      name: string;
      icon: string;
    }[];
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.name)).toBe(true);
  });

  it('inserts English payment method names when lang=en', () => {
    const db = createFreshDb();
    seedAdminUser(db);
    const { id } = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number };
    seedPaymentMethods(db, id, 'en');
    const rows = db.prepare('SELECT name FROM payment_methods').all() as { name: string }[];
    expect(rows.map((r) => r.name)).toContain('Direct debit');
    expect(rows.map((r) => r.name)).toContain('Transfer');
    expect(rows.map((r) => r.name)).toContain('Bank card');
  });

  it('is idempotent – INSERT OR IGNORE prevents duplicates', () => {
    const db = createFreshDb();
    seedAdminUser(db);
    const { id } = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number };
    seedPaymentMethods(db, id);
    seedPaymentMethods(db, id);
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
  it("seeds global reference data and admin user, sans données financières pour l'admin", () => {
    const db = createFreshDb();
    seedDatabase(db);
    const q = (table: string) =>
      (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
    expect(q('banks')).toBeGreaterThan(0);
    expect(
      (
        db
          .prepare("SELECT COUNT(*) as c FROM users WHERE username = 'admin' AND is_admin = 1")
          .get() as { c: number }
      ).c,
    ).toBe(1);
    // L'admin est un compte de gestion : pas de données financières seedées
    expect(q('account_types')).toBe(0);
    expect(q('categories')).toBe(0);
    expect(q('payment_methods')).toBe(0);
  });
});

describe('seedUserData', () => {
  it('seeds FR data and populates all 6 system refs in user_settings', () => {
    const db = createFreshDb();
    seedAdminUser(db);
    const { id: userId } = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number };
    seedUserData(db, userId, 'fr');

    const settings = db
      .prepare(
        `SELECT financial_income_category_id, transfer_subcategory_id, transfer_payment_method_id,
                bank_fees_subcategory_id, social_fees_subcategory_id, prelevement_payment_method_id
         FROM user_settings WHERE user_id = ?`,
      )
      .get(userId) as
      | {
          financial_income_category_id: number | null;
          transfer_subcategory_id: number | null;
          transfer_payment_method_id: number | null;
          bank_fees_subcategory_id: number | null;
          social_fees_subcategory_id: number | null;
          prelevement_payment_method_id: number | null;
        }
      | undefined;

    expect(settings).toBeDefined();
    expect(settings?.financial_income_category_id).not.toBeNull();
    expect(settings?.transfer_subcategory_id).not.toBeNull();
    expect(settings?.transfer_payment_method_id).not.toBeNull();
    expect(settings?.bank_fees_subcategory_id).not.toBeNull();
    expect(settings?.social_fees_subcategory_id).not.toBeNull();
    expect(settings?.prelevement_payment_method_id).not.toBeNull();

    // Verify FR category name
    const cat = db
      .prepare('SELECT name FROM categories WHERE id = ?')
      .get(settings?.financial_income_category_id) as { name: string } | undefined;
    expect(cat?.name).toBe('Revenus financiers');
  });

  it('seeds EN data and populates all 6 system refs in user_settings', () => {
    const db = createFreshDb();
    seedAdminUser(db);
    const { id: userId } = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number };
    seedUserData(db, userId, 'en');

    const settings = db
      .prepare(
        `SELECT financial_income_category_id, transfer_subcategory_id, transfer_payment_method_id,
                bank_fees_subcategory_id, social_fees_subcategory_id, prelevement_payment_method_id
         FROM user_settings WHERE user_id = ?`,
      )
      .get(userId) as
      | {
          financial_income_category_id: number | null;
          transfer_subcategory_id: number | null;
          transfer_payment_method_id: number | null;
          bank_fees_subcategory_id: number | null;
          social_fees_subcategory_id: number | null;
          prelevement_payment_method_id: number | null;
        }
      | undefined;

    expect(settings).toBeDefined();
    expect(settings?.financial_income_category_id).not.toBeNull();
    expect(settings?.transfer_subcategory_id).not.toBeNull();
    expect(settings?.transfer_payment_method_id).not.toBeNull();
    expect(settings?.bank_fees_subcategory_id).not.toBeNull();
    expect(settings?.social_fees_subcategory_id).not.toBeNull();
    expect(settings?.prelevement_payment_method_id).not.toBeNull();

    // Verify EN category name
    const cat = db
      .prepare('SELECT name FROM categories WHERE id = ?')
      .get(settings?.financial_income_category_id) as { name: string } | undefined;
    expect(cat?.name).toBe('Financial income');

    // Verify EN payment method names
    const pm = db
      .prepare('SELECT name FROM payment_methods WHERE id = ?')
      .get(settings?.prelevement_payment_method_id) as { name: string } | undefined;
    expect(pm?.name).toBe('Direct debit');
  });
});
