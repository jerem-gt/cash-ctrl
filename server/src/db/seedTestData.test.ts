import type { Database } from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { generateScheduledTransactions } from '../lib/generateScheduled.js';
import { createDb, initDatabase } from './init.js';
import { seedTestData } from './seedTestData.js';

const TODAY = '2026-10-14';
// Début des mois récents du seed (-3..0) ; l'historique 2025 est volontairement hors planification
const RECENT_FROM = '2026-07-01';

// Libellé/montant (en centimes) des opérations récurrentes insérées à la main par le seed
const RECURRING_SEEDED: Array<[string, number]> = [
  ['Salaire', 280000],
  ['Loyer', 85000],
  ['EDF', 6500],
  ['Netflix', 1599],
  ['Pass Navigo', 8640],
  ['Épargne → Livret A', 30000],
];

describe('seedTestData + generateScheduledTransactions', () => {
  let db: Database;
  let userId: number;
  let seededRecurringWithoutSchedule: number;

  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
    vi.stubEnv('SEED_TODAY', TODAY);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    db = createDb(':memory:');
    initDatabase(db);
    seedTestData(db);
    userId = (db.prepare("SELECT id FROM users WHERE username = 'test'").get() as { id: number })
      .id;

    seededRecurringWithoutSchedule = RECURRING_SEEDED.reduce((count, [description, amount]) => {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS n FROM transactions
           WHERE user_id = ? AND description = ? AND amount = ? AND date >= ?
             AND scheduled_id IS NULL`,
        )
        .get(userId, description, amount, RECENT_FROM) as { n: number };
      return count + row.n;
    }, 0);

    generateScheduledTransactions(userId, db);
  });

  afterAll(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    db.close();
  });

  it('rattache chaque transaction récurrente du seed à sa planification', () => {
    expect(seededRecurringWithoutSchedule).toBe(0);
  });

  it('ne crée aucun doublon (compte, date, montant, type, libellé) hors virements', () => {
    const duplicates = db
      .prepare(
        `SELECT account_id, date, amount, type, description, COUNT(*) AS n
         FROM transactions
         WHERE user_id = ? AND transfer_peer_id IS NULL
         GROUP BY account_id, date, amount, type, description
         HAVING COUNT(*) > 1`,
      )
      .all(userId);

    expect(duplicates).toEqual([]);
  });

  it('ne duplique pas non plus les virements planifiés', () => {
    const duplicates = db
      .prepare(
        `SELECT account_id, date, amount, description, COUNT(*) AS n
         FROM transactions
         WHERE user_id = ? AND transfer_peer_id IS NOT NULL AND description = 'Épargne → Livret A'
         GROUP BY account_id, date, amount, type, description
         HAVING COUNT(*) > 1`,
      )
      .all(userId);

    expect(duplicates).toEqual([]);
  });

  it('génère des occurrences futures à la suite du seed', () => {
    const future = db
      .prepare(
        'SELECT COUNT(*) AS n FROM transactions WHERE user_id = ? AND scheduled_id IS NOT NULL AND date > ?',
      )
      .get(userId, TODAY) as { n: number };

    expect(future.n).toBeGreaterThan(0);
  });
});
