import { describe, it, expect, beforeEach } from 'vitest';
import { setupFixtures, type Fixtures, SEED } from '../tests/helpers/testDb.js';
import { generateScheduledTransactions } from './generateScheduled.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function insertSchedule(
  f: Fixtures,
  overrides: Partial<{
    type: 'income' | 'expense';
    amount: number;
    description: string;
    category_id: number;
    payment_method_id: number;
    recurrence_unit: 'day' | 'week' | 'month' | 'year';
    recurrence_interval: number;
    recurrence_day: number | null;
    recurrence_month: number | null;
    to_account_id: number | null;
    weekend_handling: 'allow' | 'before' | 'after';
    start_date: string;
    end_date: string | null;
    active: number;
  }> = {},
): number {
  const d = {
    type: 'expense' as const,
    amount: 100,
    description: 'Test',
    category_id: SEED.CAT_AUTRE,
    payment_method_id: SEED.PM_VIREMENT,
    recurrence_unit: 'month' as const,
    recurrence_interval: 1,
    recurrence_day: null,
    recurrence_month: null,
    to_account_id: null,
    weekend_handling: 'allow' as const,
    start_date: '2026-01-01',
    end_date: null,
    active: 1,
    ...overrides,
  };

  return Number(f.db.prepare(`
    INSERT INTO scheduled_transactions
      (user_id, account_id, type, amount, description, category_id, payment_method_id,
       recurrence_unit, recurrence_interval, recurrence_day, recurrence_month,
       to_account_id, weekend_handling, start_date, end_date, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    f.userId, f.accountId, d.type, d.amount, d.description, d.category_id, d.payment_method_id,
    d.recurrence_unit, d.recurrence_interval, d.recurrence_day, d.recurrence_month,
    d.to_account_id, d.weekend_handling, d.start_date, d.end_date, d.active,
  ).lastInsertRowid);
}

function setLeadDays(f: Fixtures, days: number): void {
  f.db.prepare('INSERT OR REPLACE INTO user_settings (user_id, lead_days) VALUES (?, ?)').run(f.userId, days);
}

function countTx(f: Fixtures, schedId: number): number {
  return (f.db.prepare('SELECT count(*) as n FROM transactions WHERE scheduled_id = ?').get(schedId) as { n: number }).n;
}

function getTx(f: Fixtures, schedId: number) {
  return f.db.prepare(
    'SELECT * FROM transactions WHERE scheduled_id = ? ORDER BY date',
  ).all(schedId) as Array<{
    id: number; account_id: number; type: string; amount: number;
    date: string; transfer_peer_id: number | null; scheduled_id: number;
  }>;
}

function getSchedule(f: Fixtures, id: number) {
  return f.db.prepare('SELECT * FROM scheduled_transactions WHERE id = ?').get(id) as {
    last_generated_until: string | null;
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('generateScheduledTransactions', () => {
  let f: Fixtures;

  beforeEach(() => {
    f = setupFixtures();
  });

  it('generates correct number of daily occurrences within horizon', () => {
    // Start yesterday, daily, lead=3 → yesterday, today, +1, +2, +3 = 5 occurrences
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];

    const id = insertSchedule(f, {
      recurrence_unit: 'day',
      recurrence_interval: 1,
      start_date: yStr,
    });
    setLeadDays(f, 3);

    generateScheduledTransactions(f.userId, f.db);

    // horizon = today + 3 days = 4 days from yesterday
    expect(countTx(f, id)).toBe(5); // yesterday, today, +1, +2, +3
  });

  it('respects lead_days: no occurrences beyond horizon', () => {
    const today = new Date().toISOString().split('T')[0];

    const id = insertSchedule(f, {
      recurrence_unit: 'day',
      recurrence_interval: 1,
      start_date: today,
    });
    setLeadDays(f, 2);

    generateScheduledTransactions(f.userId, f.db);

    // today, +1, +2 = 3
    expect(countTx(f, id)).toBe(3);
  });

  it('respects end_date', () => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 1);

    const id = insertSchedule(f, {
      recurrence_unit: 'day',
      recurrence_interval: 1,
      start_date: today.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    });
    setLeadDays(f, 10);

    generateScheduledTransactions(f.userId, f.db);

    // Only today and today+1, because end_date cuts off at +1
    expect(countTx(f, id)).toBe(2);
  });

  it('skips inactive schedules', () => {
    const id = insertSchedule(f, { active: 0 });
    setLeadDays(f, 30);

    generateScheduledTransactions(f.userId, f.db);

    expect(countTx(f, id)).toBe(0);
  });

  it('is idempotent: calling twice does not duplicate', () => {
    const today = new Date().toISOString().split('T')[0];
    const id = insertSchedule(f, {
      recurrence_unit: 'day',
      recurrence_interval: 1,
      start_date: today,
    });
    setLeadDays(f, 5);

    generateScheduledTransactions(f.userId, f.db);
    const firstCount = countTx(f, id);

    generateScheduledTransactions(f.userId, f.db);

    expect(countTx(f, id)).toBe(firstCount);
  });

  it('updates last_generated_until to the last nominal date', () => {
    const today = new Date().toISOString().split('T')[0];
    const id = insertSchedule(f, {
      recurrence_unit: 'day',
      recurrence_interval: 1,
      start_date: today,
    });
    setLeadDays(f, 2);

    generateScheduledTransactions(f.userId, f.db);

    const horizonDate = new Date();
    horizonDate.setDate(horizonDate.getDate() + 2);
    const expected = horizonDate.toISOString().split('T')[0];

    expect(getSchedule(f, id).last_generated_until).toBe(expected);
  });

  it('applies weekend_handling=after: Saturday → Monday', () => {
    // Find next Saturday
    const d = new Date();
    while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
    const satStr = d.toISOString().split('T')[0];

    const monDate = new Date(d);
    monDate.setDate(d.getDate() + 2);
    const monStr = monDate.toISOString().split('T')[0];

    const id = insertSchedule(f, {
      recurrence_unit: 'day',
      recurrence_interval: 1,
      start_date: satStr,
      end_date: satStr,
      weekend_handling: 'after',
    });
    setLeadDays(f, 10);

    generateScheduledTransactions(f.userId, f.db);

    const txs = getTx(f, id);
    expect(txs).toHaveLength(1);
    expect(txs[0].date).toBe(monStr);
  });

  it('applies weekend_handling=before: Sunday → Friday', () => {
    // Find next Sunday
    const d = new Date();
    while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
    const sunStr = d.toISOString().split('T')[0];

    const friDate = new Date(d);
    friDate.setDate(d.getDate() - 2);
    const friStr = friDate.toISOString().split('T')[0];

    const id = insertSchedule(f, {
      recurrence_unit: 'day',
      recurrence_interval: 1,
      start_date: sunStr,
      end_date: sunStr,
      weekend_handling: 'before',
    });
    setLeadDays(f, 10);

    generateScheduledTransactions(f.userId, f.db);

    const txs = getTx(f, id);
    expect(txs).toHaveLength(1);
    expect(txs[0].date).toBe(friStr);
  });

  // ── Transfer tests ──────────────────────────────────────────────────────────

  it('transfer: creates an expense on account and income on to_account', () => {
    const today = new Date().toISOString().split('T')[0];
    const id = insertSchedule(f, {
      payment_method_id: SEED.PM_TRANSFERT,
      to_account_id: f.account2Id,
      recurrence_unit: 'day',
      recurrence_interval: 1,
      start_date: today,
      end_date: today,
    });
    setLeadDays(f, 0);

    generateScheduledTransactions(f.userId, f.db);

    const txs = getTx(f, id);
    expect(txs).toHaveLength(2);

    const expense = txs.find(t => t.type === 'expense')!;
    const income  = txs.find(t => t.type === 'income')!;

    expect(expense.account_id).toBe(f.accountId);
    expect(income.account_id).toBe(f.account2Id);
    expect(expense.date).toBe(today);
    expect(income.date).toBe(today);
  });

  it('transfer: expense and income are linked via transfer_peer_id', () => {
    const today = new Date().toISOString().split('T')[0];
    const id = insertSchedule(f, {
      payment_method_id: SEED.PM_TRANSFERT,
      to_account_id: f.account2Id,
      recurrence_unit: 'day',
      recurrence_interval: 1,
      start_date: today,
      end_date: today,
    });
    setLeadDays(f, 0);

    generateScheduledTransactions(f.userId, f.db);

    const txs = getTx(f, id);
    const expense = txs.find(t => t.type === 'expense')!;
    const income  = txs.find(t => t.type === 'income')!;

    expect(expense.transfer_peer_id).toBe(income.id);
    expect(income.transfer_peer_id).toBe(expense.id);
  });

  it('transfer: multiple occurrences produce N*2 transactions', () => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(today.getDate() + 2);

    const id = insertSchedule(f, {
      payment_method_id: SEED.PM_TRANSFERT,
      to_account_id: f.account2Id,
      recurrence_unit: 'day',
      recurrence_interval: 1,
      start_date: today.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0],
    });
    setLeadDays(f, 10);

    generateScheduledTransactions(f.userId, f.db);

    // 3 days × 2 legs = 6
    expect(countTx(f, id)).toBe(6);
  });

  it('transfer: idempotent on second call', () => {
    const today = new Date().toISOString().split('T')[0];
    const id = insertSchedule(f, {
      payment_method_id: SEED.PM_TRANSFERT,
      to_account_id: f.account2Id,
      recurrence_unit: 'day',
      recurrence_interval: 1,
      start_date: today,
      end_date: today,
    });
    setLeadDays(f, 0);

    generateScheduledTransactions(f.userId, f.db);
    generateScheduledTransactions(f.userId, f.db);

    expect(countTx(f, id)).toBe(2);
  });

  it('monthly recurrence with recurrence_day=31 clamps to month end in Feb', () => {
    // end_date limits to Feb so March is never generated even with large lead_days.
    // last_generated_until pre-set to 2026-01-31 so the first (and only) next
    // occurrence is nextOccurrence(2026-01-31) = 2026-02-28 (day=31 clamped).
    const id = insertSchedule(f, {
      recurrence_unit: 'month',
      recurrence_interval: 1,
      recurrence_day: 31,
      start_date: '2026-01-01',
      end_date: '2026-02-28',
    });

    f.db.prepare('UPDATE scheduled_transactions SET last_generated_until = ? WHERE id = ?').run('2026-01-31', id);

    setLeadDays(f, 30);
    generateScheduledTransactions(f.userId, f.db);

    const txs = getTx(f, id);
    expect(txs).toHaveLength(1);
    expect(txs[0].date).toBe('2026-02-28');
  });
});
