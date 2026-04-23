import Database from 'better-sqlite3';

// IDs des données seed (stables car AUTOINCREMENT depuis 1)
export const SEED = {
  BANK_ID:        1, // 'DefaultBank'
  AT_COURANT:     1, // 'Courant'
  AT_EPARGNE:     2, // 'Épargne'
  CAT_AUTRE:      1,
  CAT_SALAIRE:    2,
  CAT_ALIMENTATION: 3,
  CAT_LOISIRS:    4,
  CAT_LOYER:      5,
  CAT_TRANSFERT:  6,
  PM_VIREMENT:    1,
  PM_CARTE:       2,
  PM_TRANSFERT:   3,
} as const;

export function createTestDb(): InstanceType<typeof Database> {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE banks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT UNIQUE NOT NULL,
      logo       TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE account_types (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE accounts (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name             TEXT NOT NULL,
      bank_id          INTEGER REFERENCES banks(id),
      account_type_id  INTEGER REFERENCES account_types(id),
      initial_balance  REAL NOT NULL DEFAULT 0,
      created_at       TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT UNIQUE NOT NULL,
      color      TEXT NOT NULL DEFAULT '#9E9A92',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE payment_methods (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT UNIQUE NOT NULL,
      icon       TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE scheduled_transactions (
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
    CREATE TABLE transactions (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id        INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      type              TEXT NOT NULL CHECK(type IN ('income','expense')),
      amount            REAL NOT NULL CHECK(amount > 0),
      description       TEXT NOT NULL,
      category_id       INTEGER REFERENCES categories(id),
      date              TEXT NOT NULL,
      transfer_peer_id  INTEGER,
      scheduled_id      INTEGER REFERENCES scheduled_transactions(id) ON DELETE SET NULL,
      validated         INTEGER NOT NULL DEFAULT 0,
      payment_method_id INTEGER REFERENCES payment_methods(id),
      notes             TEXT,
      created_at        TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE user_settings (
      user_id   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      lead_days INTEGER NOT NULL DEFAULT 30
    );
  `);

  // Seed reference data (IDs match SEED constants above)
  db.exec(`
    INSERT INTO banks (name) VALUES ('DefaultBank');
    INSERT INTO account_types (name) VALUES ('Courant'), ('Épargne');
    INSERT INTO categories (name) VALUES
      ('Autre'), ('Salaire'), ('Alimentation'), ('Loisirs'), ('Loyer'), ('Transfert');
    INSERT INTO payment_methods (name) VALUES
      ('Virement'), ('Carte Bancaire'), ('Transfert');
  `);

  return db;
}

export interface Fixtures {
  db: InstanceType<typeof Database>;
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
    db.prepare('INSERT INTO accounts (user_id, name) VALUES (?, ?)').run(userId, 'Compte principal').lastInsertRowid,
  );
  const account2Id = Number(
    db.prepare('INSERT INTO accounts (user_id, name) VALUES (?, ?)').run(userId, 'Épargne').lastInsertRowid,
  );

  return { db, userId, accountId, account2Id };
}
