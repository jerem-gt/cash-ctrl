import { describe, expect, it } from 'vitest';

import { createDb, initDatabase } from './init';

describe('initDatabase', () => {
  it("removes the obsolete CHECK on account_types.envelope_type so 'savings' is accepted", () => {
    const db = createDb(':memory:');
    // Simulate a legacy DB created before 'savings' was added to ENVELOPE_TYPES:
    // the table is built by hand with the old CHECK, and user_version is bumped
    // past the current MIGRATIONS array (reproducing the production drift where
    // historical migrations were removed) so any versioned fix would be skipped.
    db.exec(`
      CREATE TABLE account_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        envelope_type TEXT CHECK (envelope_type IN ('life_insurance', 'per', 'investment', 'loan')),
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE (user_id, name)
      );
    `);
    db.pragma('user_version = 99');

    initDatabase(db);
    // Insert a row after init so the FK to users (created by initSchema) is satisfied.
    db.prepare("INSERT INTO users (username, password_hash) VALUES ('u', 'x')").run();
    db.prepare(
      "INSERT INTO account_types (user_id, name, envelope_type) VALUES (?, 'Épargne', NULL)",
    ).run(1);

    const schema = db
      .prepare<
        [],
        { sql: string }
      >("SELECT sql FROM sqlite_master WHERE type='table' AND name='account_types'")
      .get()!.sql;
    expect(schema).not.toContain('CHECK');

    // The row that existed before the repair survived and can now take 'savings'.
    const r = db
      .prepare("UPDATE account_types SET envelope_type='savings' WHERE name='Épargne'")
      .run();
    expect(r.changes).toBe(1);
  });

  it('is a no-op on a fresh DB whose schema has no CHECK', () => {
    const db = createDb(':memory:');
    initDatabase(db);
    // Calling twice should not throw or change anything observable.
    initDatabase(db);
    const schema = db
      .prepare<
        [],
        { sql: string }
      >("SELECT sql FROM sqlite_master WHERE type='table' AND name='account_types'")
      .get()!.sql;
    expect(schema).not.toContain('CHECK');
  });
});
