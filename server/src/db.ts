import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';

export const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = path.join(DATA_DIR, 'cashctrl.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
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
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id       INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type             TEXT NOT NULL CHECK(type IN ('income','expense')),
    amount           REAL NOT NULL CHECK(amount > 0),
    description      TEXT NOT NULL,
    category         TEXT NOT NULL,
    date             TEXT NOT NULL,
    transfer_peer_id INTEGER,
    created_at       TEXT DEFAULT (datetime('now'))
  );
`);

// Migrations
try { db.exec('ALTER TABLE transactions ADD COLUMN transfer_peer_id INTEGER'); } catch { /* already exists */ }
try { db.exec("ALTER TABLE accounts ADD COLUMN bank TEXT NOT NULL DEFAULT ''"); } catch { /* already exists */ }
try { db.exec('ALTER TABLE banks ADD COLUMN logo TEXT'); } catch { /* already exists */ }

// Migration: restore accents in account types (previously stripped for enum compat)
try {
  db.exec(`UPDATE accounts SET type = 'Épargne' WHERE type = 'Epargne'`);
  db.exec(`UPDATE accounts SET type = 'Crédit'  WHERE type = 'Credit'`);
} catch { /* ignore */ }

// Migration: drop user_id from categories if it exists (table was initially created with it)
const catColumns = (db.prepare('PRAGMA table_info(categories)').all() as { name: string }[]).map(c => c.name);
if (catColumns.includes('user_id')) {
  db.exec(`
    CREATE TABLE categories_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#9E9A92',
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO categories_new (id, name, color, created_at)
      SELECT id, name, color, created_at FROM categories GROUP BY name;
    DROP TABLE categories;
    ALTER TABLE categories_new RENAME TO categories;
  `);
}

// Seed default banks (INSERT OR IGNORE so new defaults are added on each restart)
const DEFAULT_BANKS = ['BoursoBank', 'Fortuneo', 'Crédit Agricole', 'Linxea', 'Amundi', 'BNP Paribas', 'Société Générale', 'Revolut', 'N26'];
{
  const insertBank = db.prepare('INSERT OR IGNORE INTO banks (name, logo) VALUES (?, NULL)');
  const seedBanks = db.transaction(() => { for (const b of DEFAULT_BANKS) insertBank.run(b); });
  seedBanks();
}

// Seed default account types if table is empty
const DEFAULT_ACCOUNT_TYPES = ['Courant', 'Épargne', 'Livret', 'Crédit', 'Autre'];
const atCount = (db.prepare('SELECT COUNT(*) as n FROM account_types').get() as { n: number }).n;
if (atCount === 0) {
  const insertAt = db.prepare('INSERT INTO account_types (name) VALUES (?)');
  const seedAt = db.transaction(() => { for (const t of DEFAULT_ACCOUNT_TYPES) insertAt.run(t); });
  seedAt();
}

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
];
const catCount = (db.prepare('SELECT COUNT(*) as n FROM categories').get() as { n: number }).n;
if (catCount === 0) {
  const insertCat = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)');
  const seedAll = db.transaction(() => { for (const c of DEFAULT_CATEGORIES) insertCat.run(c.name, c.color); });
  seedAll();
}

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
  bank: string;
  type: string;
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
  category: string;
  date: string;
  transfer_peer_id: number | null;
  created_at: string;
  account_name?: string;
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

  getCategories: db.prepare<[], Category>('SELECT * FROM categories ORDER BY created_at'),
  getCategoryById: db.prepare<[number], Category>('SELECT * FROM categories WHERE id = ?'),
  insertCategory: db.prepare<[string, string]>('INSERT INTO categories (name, color) VALUES (?, ?)'),
  updateCategory: db.prepare<[string, string, number]>('UPDATE categories SET name = ?, color = ? WHERE id = ?'),
  deleteCategory: db.prepare<[number]>('DELETE FROM categories WHERE id = ?'),

  getUserByUsername: db.prepare<[string], User>('SELECT * FROM users WHERE username = ?'),
  getUserById: db.prepare<[number], User>('SELECT * FROM users WHERE id = ?'),
  updatePassword: db.prepare<[string, number]>('UPDATE users SET password_hash = ? WHERE id = ?'),

  getAccounts: db.prepare<[number], Account>('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at'),
  insertAccount: db.prepare<[number, string, string, string, number]>(
    'INSERT INTO accounts (user_id, name, bank, type, initial_balance) VALUES (?, ?, ?, ?, ?)'
  ),
  updateAccount: db.prepare<[string, string, string, number, number, number]>(
    'UPDATE accounts SET name = ?, bank = ?, type = ?, initial_balance = ? WHERE id = ? AND user_id = ?'
  ),
  deleteAccount: db.prepare<[number, number]>('DELETE FROM accounts WHERE id = ? AND user_id = ?'),
  getAccountById: db.prepare<[number, number], Account>('SELECT * FROM accounts WHERE id = ? AND user_id = ?'),

  getTransactions: db.prepare<[number], Transaction>(
    `SELECT t.*, a.name as account_name
     FROM transactions t
     JOIN accounts a ON t.account_id = a.id
     WHERE t.user_id = ?
     ORDER BY t.date DESC, t.created_at DESC`
  ),
  insertTransaction: db.prepare<[number, number, string, number, string, string, string]>(
    'INSERT INTO transactions (user_id, account_id, type, amount, description, category, date) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ),
  updateTransaction: db.prepare<[number, string, number, string, string, string, number, number]>(
    'UPDATE transactions SET account_id = ?, type = ?, amount = ?, description = ?, category = ?, date = ? WHERE id = ? AND user_id = ?'
  ),
  deleteTransaction: db.prepare<[number, number]>('DELETE FROM transactions WHERE id = ? AND user_id = ?'),
  getTransactionById: db.prepare<[number, number], Transaction>(
    'SELECT * FROM transactions WHERE id = ? AND user_id = ?'
  ),
  getTransactionsByAccount: db.prepare<[number, number], Transaction>(
    `SELECT t.*, a.name as account_name
     FROM transactions t
     JOIN accounts a ON t.account_id = a.id
     WHERE t.user_id = ? AND t.account_id = ?
     ORDER BY t.date DESC, t.created_at DESC`
  ),

  setPeerTransfer: db.prepare<[number, number]>(
    'UPDATE transactions SET transfer_peer_id = ? WHERE id = ?'
  ),
};
