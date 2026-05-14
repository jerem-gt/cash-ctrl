import type { Database } from 'better-sqlite3';

import {
  RECURRENCE_UNITS,
  REIMBURSEMENT_STATUSES,
  STOCK_OPERATION_TYPES,
  TRANSACTION_TYPES,
  WEEKEND_HANDLING,
} from '../constants';

const sqlIn = (arr: readonly string[]) => arr.map((v) => `'${v}'`).join(', ');

export function initSchema(db: Database) {
  db.exec(`
        CREATE TABLE IF NOT EXISTS scheduled_transactions
        (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id              INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            account_id           INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
            type                 TEXT    NOT NULL CHECK (type IN (${sqlIn(TRANSACTION_TYPES)})),
            amount               INTEGER NOT NULL CHECK (amount > 0),
            description          TEXT    NOT NULL,
            subcategory_id       INTEGER REFERENCES subcategories (id),
            payment_method_id    INTEGER REFERENCES payment_methods (id),
            notes                TEXT,
            recurrence_unit      TEXT    NOT NULL CHECK (recurrence_unit IN (${sqlIn(RECURRENCE_UNITS)})),
            recurrence_interval  INTEGER NOT NULL DEFAULT 1 CHECK (recurrence_interval > 0),
            recurrence_day       INTEGER,
            recurrence_month     INTEGER,
            to_account_id        INTEGER REFERENCES accounts (id) ON DELETE SET NULL,
            weekend_handling     TEXT    NOT NULL DEFAULT 'allow' CHECK (weekend_handling IN (${sqlIn(WEEKEND_HANDLING)})),
            start_date           TEXT    NOT NULL,
            end_date             TEXT,
            active               INTEGER NOT NULL DEFAULT 1,
            last_generated_until TEXT,
            created_at           TEXT             DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS user_settings
        (
            user_id            INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
            lead_days          INTEGER NOT NULL DEFAULT 30,
            backup_enabled     INTEGER NOT NULL DEFAULT 0,
            backup_frequency_h INTEGER NOT NULL DEFAULT 24,
            backup_max_files   INTEGER NOT NULL DEFAULT 7,
            backup_last_at     TEXT,
            backup_last_hash   TEXT,
            updated_at         TEXT DEFAULT (datetime('now'))
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
            initial_balance INTEGER NOT NULL DEFAULT 0,
            opening_date    TEXT,
            closed_at       TEXT,
            created_at      TEXT             DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS categories
        (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            name       TEXT    NOT NULL,
            icon       TEXT    NOT NULL,
            created_at TEXT    DEFAULT (datetime('now')),
            UNIQUE (user_id, name)
        );

        CREATE TABLE IF NOT EXISTS subcategories
        (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            category_id INTEGER NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
            name        TEXT    NOT NULL,
            created_at  TEXT    DEFAULT (datetime('now')),
            UNIQUE (category_id, name)
        );

        CREATE TABLE IF NOT EXISTS account_types
        (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id       INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            name          TEXT    NOT NULL,
            is_investment INTEGER NOT NULL DEFAULT 0,
            is_loan       INTEGER NOT NULL DEFAULT 0,
            created_at    TEXT             DEFAULT (datetime('now')),
            UNIQUE (user_id, name)
        );

        CREATE TABLE IF NOT EXISTS stock_positions
        (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            account_id INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
            ticker     TEXT    NOT NULL,
            quantity   REAL    NOT NULL DEFAULT 0,
            avg_price  REAL    NOT NULL DEFAULT 0,
            updated_at TEXT             DEFAULT (datetime('now')),
            created_at TEXT             DEFAULT (datetime('now')),
            UNIQUE (account_id, ticker)
        );

        CREATE TABLE IF NOT EXISTS stock_operations
        (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id              INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            account_id           INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
            transaction_id       INTEGER REFERENCES transactions (id) ON DELETE CASCADE,
            fees_transaction_id  INTEGER REFERENCES transactions (id) ON DELETE SET NULL,
            ticker               TEXT    NOT NULL,
            type                 TEXT    NOT NULL CHECK (type IN (${sqlIn(STOCK_OPERATION_TYPES)})),
            quantity             REAL    NOT NULL,
            price_per_share      REAL    NOT NULL,
            fees                 INTEGER NOT NULL DEFAULT 0,
            date                 TEXT    NOT NULL,
            transfer_peer_id     INTEGER REFERENCES stock_operations (id) ON DELETE SET NULL,
            created_at           TEXT             DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_stock_txid ON stock_operations(transaction_id);
        CREATE INDEX IF NOT EXISTS idx_stock_ops_account_ticker ON stock_operations (account_id, ticker);

        CREATE TRIGGER IF NOT EXISTS stock_op_fees_cleanup
        AFTER DELETE ON stock_operations
        WHEN OLD.fees_transaction_id IS NOT NULL
        BEGIN
            DELETE FROM transactions WHERE id = OLD.fees_transaction_id;
        END;

        CREATE TABLE IF NOT EXISTS stock_prices
        (
            ticker     TEXT PRIMARY KEY,
            price      REAL    NOT NULL,
            currency   TEXT NOT NULL DEFAULT 'EUR',
            fetched_at TEXT NOT NULL,
            name       TEXT
        );

        CREATE TABLE IF NOT EXISTS banks
        (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT UNIQUE NOT NULL,
            logo       TEXT,
            domain     TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS payment_methods
        (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            name       TEXT    NOT NULL,
            icon       TEXT    NOT NULL DEFAULT '',
            created_at TEXT             DEFAULT (datetime('now')),
            UNIQUE (user_id, name)
        );

        CREATE TABLE IF NOT EXISTS transactions
        (
            id                    INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id               INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            account_id            INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
            type                  TEXT    NOT NULL CHECK (type IN (${sqlIn(TRANSACTION_TYPES)})),
            amount                INTEGER NOT NULL CHECK (amount > 0),
            description           TEXT    NOT NULL,
            subcategory_id        INTEGER REFERENCES subcategories (id),
            date                  TEXT    NOT NULL,
            transfer_peer_id      INTEGER REFERENCES transactions (id) ON DELETE SET NULL,
            validated             INTEGER NOT NULL DEFAULT 0,
            payment_method_id     INTEGER REFERENCES payment_methods (id),
            scheduled_id          INTEGER REFERENCES scheduled_transactions(id) ON DELETE SET NULL,
            notes                 TEXT,
            reimbursement_status  TEXT    CHECK (reimbursement_status IN (${sqlIn(REIMBURSEMENT_STATUSES)})),
            created_at            TEXT             DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date DESC, created_at DESC);

        CREATE TABLE IF NOT EXISTS reimbursements
        (
            user_id               INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            transaction_id        INTEGER NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
            linked_transaction_id INTEGER NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
            PRIMARY KEY (transaction_id, linked_transaction_id)
        );

        CREATE TABLE IF NOT EXISTS transaction_splits
        (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id        INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            transaction_id INTEGER NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
            subcategory_id INTEGER NOT NULL REFERENCES subcategories (id),
            amount         INTEGER NOT NULL CHECK (amount > 0)
        );

        CREATE INDEX IF NOT EXISTS idx_splits_txid ON transaction_splits(transaction_id);

        CREATE TABLE IF NOT EXISTS loans
        (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id        INTEGER NOT NULL UNIQUE REFERENCES accounts (id) ON DELETE CASCADE,
            user_id           INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            principal_amount  INTEGER NOT NULL CHECK (principal_amount > 0),
            interest_rate     REAL    NOT NULL CHECK (interest_rate >= 0),
            duration_months   INTEGER NOT NULL CHECK (duration_months > 0),
            start_date        TEXT    NOT NULL,
            monthly_payment    INTEGER NOT NULL,
            source_account_id  INTEGER NOT NULL REFERENCES accounts (id),
            deposit_account_id     INTEGER NOT NULL REFERENCES accounts (id),
            deposit_transaction_id INTEGER REFERENCES transactions (id) ON DELETE SET NULL,
            created_at             TEXT             DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS loan_installments
        (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id             INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            loan_id             INTEGER NOT NULL REFERENCES loans (id) ON DELETE CASCADE,
            installment_number  INTEGER NOT NULL,
            due_date            TEXT    NOT NULL,
            total_amount        INTEGER NOT NULL CHECK (total_amount > 0),
            principal_amount    INTEGER NOT NULL,
            interest_amount     INTEGER NOT NULL,
            transaction_id      INTEGER REFERENCES transactions (id) ON DELETE SET NULL,
            UNIQUE (loan_id, installment_number)
        );
    `);
}
