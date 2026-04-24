import type { Database } from 'better-sqlite3';

export function initSchema(db: Database) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS scheduled_transactions
        (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id              INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            account_id           INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
            type                 TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
            amount               REAL    NOT NULL CHECK (amount > 0),
            description          TEXT    NOT NULL,
            category_id          INTEGER REFERENCES categories (id),
            payment_method_id    INTEGER REFERENCES payment_methods (id),
            notes                TEXT,
            recurrence_unit      TEXT    NOT NULL CHECK (recurrence_unit IN ('day', 'week', 'month', 'year')),
            recurrence_interval  INTEGER NOT NULL DEFAULT 1 CHECK (recurrence_interval > 0),
            recurrence_day       INTEGER,
            recurrence_month     INTEGER,
            to_account_id        INTEGER REFERENCES accounts (id) ON DELETE SET NULL,
            weekend_handling     TEXT    NOT NULL DEFAULT 'allow' CHECK (weekend_handling IN ('allow', 'before', 'after')),
            start_date           TEXT    NOT NULL,
            end_date             TEXT,
            active               INTEGER NOT NULL DEFAULT 1,
            last_generated_until TEXT,
            created_at           TEXT             DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS user_settings
        (
            user_id   INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
            lead_days INTEGER NOT NULL DEFAULT 30
        );

        CREATE TABLE IF NOT EXISTS users
        (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT UNIQUE NOT NULL,
            password_hash TEXT        NOT NULL,
            created_at    TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS accounts
        (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            name            TEXT    NOT NULL,
            bank_id         INTEGER NOT NULL REFERENCES banks (id),
            account_type_id INTEGER NOT NULL REFERENCES account_types (id),
            initial_balance REAL    NOT NULL DEFAULT 0,
            created_at      TEXT             DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS categories
        (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            color      TEXT NOT NULL DEFAULT '#9E9A92',
            created_at TEXT          DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS account_types
        (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT UNIQUE NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS banks
        (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT UNIQUE NOT NULL,
            logo       TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS payment_methods
        (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT UNIQUE NOT NULL,
            icon       TEXT        NOT NULL DEFAULT '',
            created_at TEXT                 DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS transactions
        (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id           INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            account_id        INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
            type              TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
            amount            REAL    NOT NULL CHECK (amount > 0),
            description       TEXT    NOT NULL,
            category_id       INTEGER REFERENCES categories (id),
            date              TEXT    NOT NULL,
            transfer_peer_id  INTEGER,
            validated         INTEGER NOT NULL DEFAULT 0,
            payment_method_id INTEGER REFERENCES payment_methods (id),
            scheduled_id      INTEGER REFERENCES scheduled_transactions(id) ON DELETE SET NULL,
            notes             TEXT,
            created_at        TEXT             DEFAULT (datetime('now'))
        );
    `);
}