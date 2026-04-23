import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'node:path';
import fs from 'node:fs';

export const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = path.join(DATA_DIR, 'cashctrl.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS scheduled_transactions (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id           INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type                 TEXT NOT NULL CHECK(type IN ('income','expense')),
    amount               REAL NOT NULL CHECK(amount > 0),
    description          TEXT NOT NULL,
    category_id          INTEGER REFERENCES categories(id),
    payment_method_id    INTEGER REFERENCES payment_methods(id),
    notes                TEXT,
    recurrence_unit      TEXT NOT NULL CHECK(recurrence_unit IN ('day','week','month','year')),
    recurrence_interval  INTEGER NOT NULL DEFAULT 1 CHECK(recurrence_interval > 0),
    recurrence_day       INTEGER,
    recurrence_month     INTEGER,
    to_account_id        INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    weekend_handling     TEXT NOT NULL DEFAULT 'allow' CHECK(weekend_handling IN ('allow','before','after')),
    start_date           TEXT NOT NULL,
    end_date             TEXT,
    active               INTEGER NOT NULL DEFAULT 1,
    last_generated_until TEXT,
    created_at           TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    lead_days INTEGER NOT NULL DEFAULT 30
  );

  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    bank            TEXT NOT NULL DEFAULT '',
    type            TEXT NOT NULL DEFAULT 'Courant',
    initial_balance REAL NOT NULL DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    color      TEXT NOT NULL DEFAULT '#9E9A92',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS account_types (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS banks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT UNIQUE NOT NULL,
    logo       TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payment_methods (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT UNIQUE NOT NULL,
    icon       TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id        INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type              TEXT NOT NULL CHECK(type IN ('income','expense')),
    amount            REAL NOT NULL CHECK(amount > 0),
    description       TEXT NOT NULL,
    category_id       INTEGER REFERENCES categories(id),
    date              TEXT NOT NULL,
    transfer_peer_id  INTEGER,
    validated         INTEGER NOT NULL DEFAULT 0,
    payment_method_id INTEGER REFERENCES payment_methods(id),
    notes             TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );
`);

// Migrations pour DBs créées avant l'ajout de ces colonnes
try { db.exec('ALTER TABLE scheduled_transactions ADD COLUMN to_account_id INTEGER'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE transactions ADD COLUMN scheduled_id INTEGER REFERENCES scheduled_transactions(id) ON DELETE SET NULL'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE transactions ADD COLUMN transfer_peer_id INTEGER'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE transactions ADD COLUMN validated INTEGER NOT NULL DEFAULT 0'); } catch { /* already exists */ }
try { db.exec("ALTER TABLE transactions ADD COLUMN payment_method TEXT NOT NULL DEFAULT ''"); } catch { /* already exists */ }
try { db.exec('ALTER TABLE transactions ADD COLUMN notes TEXT'); } catch { /* already exists */ }
try { db.exec("ALTER TABLE accounts ADD COLUMN bank TEXT NOT NULL DEFAULT ''"); } catch { /* already exists */ }
try { db.exec('ALTER TABLE banks ADD COLUMN logo TEXT'); } catch { /* already exists */ }
try { db.exec("ALTER TABLE payment_methods ADD COLUMN icon TEXT NOT NULL DEFAULT ''"); } catch { /* already exists */ }
try { db.exec('ALTER TABLE transactions ADD COLUMN category_id INTEGER'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE transactions ADD COLUMN payment_method_id INTEGER'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE scheduled_transactions ADD COLUMN category_id INTEGER'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE scheduled_transactions ADD COLUMN payment_method_id INTEGER'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE accounts ADD COLUMN bank_id INTEGER'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE accounts ADD COLUMN account_type_id INTEGER'); } catch { /* already exists */ }
try { db.exec("ALTER TABLE accounts ADD COLUMN type TEXT NOT NULL DEFAULT 'Courant'"); } catch { /* already exists */ }

// Seed default banks (INSERT OR IGNORE so new defaults are added on each restart)
const DEFAULT_BANKS = ['BoursoBank', 'Fortuneo', 'Crédit Agricole', 'Linxea', 'Amundi', 'BNP Paribas', 'Société Générale', 'Revolut', 'N26'];
{
  const insertBank = db.prepare('INSERT OR IGNORE INTO banks (name, logo) VALUES (?, NULL)');
  const seedBanks = db.transaction(() => { for (const b of DEFAULT_BANKS) insertBank.run(b); });
  seedBanks();
}

// Seed default account types if table is empty
const DEFAULT_ACCOUNT_TYPES = ['Courant', 'Épargne', 'Livret', 'Crédit', 'Autre'];
{
  const insertAt = db.prepare('INSERT OR IGNORE INTO account_types (name) VALUES (?)');
  const seedAt = db.transaction(() => { for (const t of DEFAULT_ACCOUNT_TYPES) insertAt.run(t); });
  seedAt();
}

// Migration: dédupliquer les catégories et ajouter l'index unique manquant
db.exec(`
  DELETE FROM categories WHERE id NOT IN (
    SELECT MIN(id) FROM categories GROUP BY name
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
`);

// Seed default categories if table is empty
const DEFAULT_CATEGORIES = [
  { name: 'Alimentation', color: '#7DBB4A' },
  { name: 'Loyer',        color: '#4A90D9' },
  { name: 'Transport',    color: '#E8A030' },
  { name: 'Santé',        color: '#C966A0' },
  { name: 'Loisirs',      color: '#9B6DD6' },
  { name: 'Abonnements',  color: '#5BB8C4' },
  { name: 'Salaire',      color: '#2D8A50' },
  { name: 'Épargne',      color: '#4A7F5E' },
  { name: 'Autre',        color: '#9E9A92' },
  { name: 'Transfert',    color: '#9E9A92' },
];
{
  const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)');
  const seedAll = db.transaction(() => { for (const c of DEFAULT_CATEGORIES) insertCat.run(c.name, c.color); });
  seedAll();
}

// Seed default payment methods if table is empty
const DEFAULT_PAYMENT_METHODS = [
  { name: 'Chèque',         icon: '📝' },
  { name: 'Virement',       icon: '↔️' },
  { name: 'Carte Bancaire', icon: '💳' },
  { name: 'Prélèvement',    icon: '↕️' },
  { name: 'Transfert',      icon: '🔄' },
];
{
  const insertPm = db.prepare('INSERT OR IGNORE INTO payment_methods (name, icon) VALUES (?, ?)');
  const seedPm = db.transaction(() => { for (const m of DEFAULT_PAYMENT_METHODS) insertPm.run(m.name, m.icon); });
  seedPm();
}

// Migration données : remplir category_id / payment_method_id depuis les anciennes colonnes texte
{
  const cols = (db.pragma('table_info(transactions)') as Array<{ name: string }>).map(c => c.name);
  if (cols.includes('category')) {
    db.transaction(() => {
      db.prepare(`INSERT OR IGNORE INTO categories (name, color) SELECT DISTINCT category, '#9E9A92' FROM transactions WHERE category IS NOT NULL AND category != ''`).run();
      db.prepare(`INSERT OR IGNORE INTO categories (name, color) SELECT DISTINCT category, '#9E9A92' FROM scheduled_transactions WHERE category IS NOT NULL AND category != ''`).run();
      db.prepare(`INSERT OR IGNORE INTO payment_methods (name, icon) SELECT DISTINCT payment_method, '' FROM transactions WHERE payment_method IS NOT NULL AND payment_method != ''`).run();
      db.prepare(`INSERT OR IGNORE INTO payment_methods (name, icon) SELECT DISTINCT payment_method, '' FROM scheduled_transactions WHERE payment_method IS NOT NULL AND payment_method != ''`).run();
      db.prepare(`UPDATE transactions SET category_id = (SELECT id FROM categories WHERE name = transactions.category) WHERE category_id IS NULL AND category IS NOT NULL AND category != ''`).run();
      db.prepare(`UPDATE transactions SET payment_method_id = (SELECT id FROM payment_methods WHERE name = transactions.payment_method) WHERE payment_method_id IS NULL AND payment_method IS NOT NULL AND payment_method != ''`).run();
      db.prepare(`UPDATE scheduled_transactions SET category_id = (SELECT id FROM categories WHERE name = scheduled_transactions.category) WHERE category_id IS NULL AND category IS NOT NULL AND category != ''`).run();
      db.prepare(`UPDATE scheduled_transactions SET payment_method_id = (SELECT id FROM payment_methods WHERE name = scheduled_transactions.payment_method) WHERE payment_method_id IS NULL AND payment_method IS NOT NULL AND payment_method != ''`).run();
    })();
  }
}

// Migration données : remplir bank_id / account_type_id depuis les anciennes colonnes texte
{
  const cols = (db.pragma('table_info(accounts)') as Array<{ name: string }>).map(c => c.name);
  if (cols.includes('bank') || cols.includes('type')) {
    db.transaction(() => {
      if (cols.includes('bank')) {
        db.prepare(`INSERT OR IGNORE INTO banks (name) SELECT DISTINCT "bank" FROM accounts WHERE "bank" IS NOT NULL AND "bank" != ''`).run();
        db.prepare(`UPDATE accounts SET bank_id = (SELECT id FROM banks WHERE name = accounts."bank") WHERE bank_id IS NULL AND "bank" IS NOT NULL AND "bank" != ''`).run();
      }
      if (cols.includes('type')) {
        db.prepare(`INSERT OR IGNORE INTO account_types (name) SELECT DISTINCT "type" FROM accounts WHERE "type" IS NOT NULL AND "type" != ''`).run();
        db.prepare(`UPDATE accounts SET account_type_id = (SELECT id FROM account_types WHERE name = accounts."type") WHERE account_type_id IS NULL AND "type" IS NOT NULL AND "type" != ''`).run();
      }
    })();
  }
}

// Suppression des colonnes texte legacy (remplacées par category_id / payment_method_id)
try { db.exec('ALTER TABLE transactions DROP COLUMN category'); } catch { /* déjà supprimée ou inexistante */ }
try { db.exec('ALTER TABLE transactions DROP COLUMN payment_method'); } catch { /* déjà supprimée ou inexistante */ }
try { db.exec('ALTER TABLE scheduled_transactions DROP COLUMN category'); } catch { /* déjà supprimée ou inexistante */ }
try { db.exec('ALTER TABLE scheduled_transactions DROP COLUMN payment_method'); } catch { /* déjà supprimée ou inexistante */ }
try { db.exec('ALTER TABLE accounts DROP COLUMN bank'); } catch { /* déjà supprimée ou inexistante */ }
try { db.exec('ALTER TABLE accounts DROP COLUMN type'); } catch { /* déjà supprimée ou inexistante */ }

// Seed admin user
const ADMIN_USER = process.env.ADMIN_USER ?? 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'changeme';

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(ADMIN_USER);
if (!existing) {
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(ADMIN_USER, hash);
  console.log(`[db] User "${ADMIN_USER}" created.`);
}

// ─── Typed query helpers ──────────────────────────────────────────────────────

export interface BankRecord {
  id: number;
  name: string;
  logo: string | null;
  created_at: string;
}

export interface AccountTypeRecord {
  id: number;
  name: string;
  created_at: string;
}

export interface PaymentMethodRecord {
  id: number;
  name: string;
  icon: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface User {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface Account {
  id: number;
  user_id: number;
  name: string;
  bank_id: number | null;
  bank: string; // résolu par JOIN
  account_type_id: number | null;
  type: string; // résolu par JOIN
  initial_balance: number;
  created_at: string;
}

export interface Transaction {
  id: number;
  user_id: number;
  account_id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category_id: number | null;
  category: string; // résolu par JOIN
  date: string;
  transfer_peer_id: number | null;
  scheduled_id: number | null;
  validated: number; // 0 | 1
  payment_method_id: number | null;
  payment_method: string; // résolu par JOIN
  notes: string | null;
  created_at: string;
  account_name?: string;
}

export interface ScheduledTransaction {
  id: number;
  user_id: number;
  account_id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category_id: number | null;
  category: string; // résolu par JOIN
  payment_method_id: number | null;
  payment_method: string; // résolu par JOIN
  notes: string | null;
  recurrence_unit: 'day' | 'week' | 'month' | 'year';
  recurrence_interval: number;
  recurrence_day: number | null;
  recurrence_month: number | null;
  to_account_id: number | null;
  weekend_handling: 'allow' | 'before' | 'after';
  start_date: string;
  end_date: string | null;
  active: number; // 0 | 1
  last_generated_until: string | null;
  created_at: string;
  account_name?: string;
}

export interface UserSettings {
  user_id: number;
  lead_days: number;
}

export const queries = {
  getBanks: db.prepare<[], BankRecord>('SELECT * FROM banks ORDER BY name'),
  getBankById: db.prepare<[number], BankRecord>('SELECT * FROM banks WHERE id = ?'),
  insertBank: db.prepare<[string, string | null]>('INSERT INTO banks (name, logo) VALUES (?, ?)'),
  updateBank: db.prepare<[string, string | null, number]>('UPDATE banks SET name = ?, logo = ? WHERE id = ?'),
  deleteBank: db.prepare<[number]>('DELETE FROM banks WHERE id = ?'),

  getAccountTypes: db.prepare<[], AccountTypeRecord>('SELECT * FROM account_types ORDER BY created_at'),
  getAccountTypeById: db.prepare<[number], AccountTypeRecord>('SELECT * FROM account_types WHERE id = ?'),
  insertAccountType: db.prepare<[string]>('INSERT INTO account_types (name) VALUES (?)'),
  updateAccountType: db.prepare<[string, number]>('UPDATE account_types SET name = ? WHERE id = ?'),
  deleteAccountType: db.prepare<[number]>('DELETE FROM account_types WHERE id = ?'),

  getPaymentMethods: db.prepare<[], PaymentMethodRecord>('SELECT * FROM payment_methods ORDER BY created_at'),
  getPaymentMethodById: db.prepare<[number], PaymentMethodRecord>('SELECT * FROM payment_methods WHERE id = ?'),
  insertPaymentMethod: db.prepare<[string, string]>('INSERT INTO payment_methods (name, icon) VALUES (?, ?)'),
  updatePaymentMethod: db.prepare<[string, string, number]>('UPDATE payment_methods SET name = ?, icon = ? WHERE id = ?'),
  deletePaymentMethod: db.prepare<[number]>('DELETE FROM payment_methods WHERE id = ?'),

  getCategories: db.prepare<[], Category>('SELECT * FROM categories ORDER BY created_at'),
  getCategoryById: db.prepare<[number], Category>('SELECT * FROM categories WHERE id = ?'),
  insertCategory: db.prepare<[string, string]>('INSERT INTO categories (name, color) VALUES (?, ?)'),
  updateCategory: db.prepare<[string, string, number]>('UPDATE categories SET name = ?, color = ? WHERE id = ?'),
  deleteCategory: db.prepare<[number]>('DELETE FROM categories WHERE id = ?'),

  getUserByUsername: db.prepare<[string], User>('SELECT * FROM users WHERE username = ?'),
  getUserById: db.prepare<[number], User>('SELECT * FROM users WHERE id = ?'),
  updatePassword: db.prepare<[string, number]>('UPDATE users SET password_hash = ? WHERE id = ?'),

  getAccounts: db.prepare<[number], Account>(
    `SELECT a.id, a.user_id, a.name, a.bank_id, a.account_type_id, a.initial_balance, a.created_at,
            COALESCE(b.name, '') as bank, COALESCE(at.name, '') as type
     FROM accounts a
     LEFT JOIN banks b ON a.bank_id = b.id
     LEFT JOIN account_types at ON a.account_type_id = at.id
     WHERE a.user_id = ? ORDER BY a.created_at`
  ),
  insertAccount: db.prepare<[number, string, number | null, number | null, number]>(
    'INSERT INTO accounts (user_id, name, bank_id, account_type_id, initial_balance) VALUES (?, ?, ?, ?, ?)'
  ),
  updateAccount: db.prepare<[string, number | null, number | null, number, number, number]>(
    'UPDATE accounts SET name = ?, bank_id = ?, account_type_id = ?, initial_balance = ? WHERE id = ? AND user_id = ?'
  ),
  deleteAccount: db.prepare<[number, number]>('DELETE FROM accounts WHERE id = ? AND user_id = ?'),
  getAccountById: db.prepare<[number, number], Account>(
    `SELECT a.id, a.user_id, a.name, a.bank_id, a.account_type_id, a.initial_balance, a.created_at,
            COALESCE(b.name, '') as bank, COALESCE(at.name, '') as type
     FROM accounts a
     LEFT JOIN banks b ON a.bank_id = b.id
     LEFT JOIN account_types at ON a.account_type_id = at.id
     WHERE a.id = ? AND a.user_id = ?`
  ),

  getTransactions: db.prepare<[number], Transaction>(
    `SELECT t.id, t.user_id, t.account_id, t.type, t.amount, t.description,
            t.category_id, t.payment_method_id,
            t.date, t.transfer_peer_id, t.scheduled_id, t.validated, t.notes, t.created_at,
            a.name as account_name,
            COALESCE(c.name, '') as category,
            COALESCE(pm.name, '') as payment_method
     FROM transactions t
     JOIN accounts a ON t.account_id = a.id
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
     WHERE t.user_id = ?
     ORDER BY t.date DESC, t.created_at DESC`
  ),
  insertTransaction: db.prepare<[number, number, string, number, string, number | null, string, number | null, string | null]>(
    'INSERT INTO transactions (user_id, account_id, type, amount, description, category_id, date, payment_method_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  updateTransaction: db.prepare<[number, string, number, string, number | null, string, number | null, string | null, number, number, number]>(
    'UPDATE transactions SET account_id = ?, type = ?, amount = ?, description = ?, category_id = ?, date = ?, payment_method_id = ?, notes = ?, validated = ? WHERE id = ? AND user_id = ?'
  ),
  deleteTransaction: db.prepare<[number, number]>('DELETE FROM transactions WHERE id = ? AND user_id = ?'),
  getTransactionById: db.prepare<[number, number], Transaction>(
    'SELECT * FROM transactions WHERE id = ? AND user_id = ?'
  ),
  getTransactionsByAccount: db.prepare<[number, number], Transaction>(
    `SELECT t.id, t.user_id, t.account_id, t.type, t.amount, t.description,
            t.category_id, t.payment_method_id,
            t.date, t.transfer_peer_id, t.scheduled_id, t.validated, t.notes, t.created_at,
            a.name as account_name,
            COALESCE(c.name, '') as category,
            COALESCE(pm.name, '') as payment_method
     FROM transactions t
     JOIN accounts a ON t.account_id = a.id
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
     WHERE t.user_id = ? AND t.account_id = ?
     ORDER BY t.date DESC, t.created_at DESC`
  ),

  setPeerTransfer: db.prepare<[number, number]>(
    'UPDATE transactions SET transfer_peer_id = ? WHERE id = ?'
  ),
  setValidated: db.prepare<[number, number, number]>(
    'UPDATE transactions SET validated = ? WHERE id = ? AND user_id = ?'
  ),
};
