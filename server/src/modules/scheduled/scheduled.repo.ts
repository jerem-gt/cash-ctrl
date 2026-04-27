import type { Database } from 'better-sqlite3';

import type { CreateScheduledInput, ScheduledTransaction } from './scheduled.types';

const SCHED_WITH_DETAILS = `
  SELECT s.id, s.user_id, s.account_id, s.to_account_id, s.type, s.amount, s.description,
         s.subcategory_id, s.payment_method_id, s.notes,
         s.recurrence_unit, s.recurrence_interval, s.recurrence_day, s.recurrence_month,
         s.weekend_handling, s.start_date, s.end_date, s.active, s.last_generated_until, s.created_at,
         a.name as account_name,
         sc.category_id,
         COALESCE(c.name, '') as category,
         COALESCE(sc.name, '') as subcategory,
         COALESCE(pm.name, '') as payment_method
  FROM scheduled_transactions s
  JOIN accounts a ON s.account_id = a.id
  LEFT JOIN subcategories sc ON s.subcategory_id = sc.id
  LEFT JOIN categories c ON sc.category_id = c.id
  LEFT JOIN payment_methods pm ON s.payment_method_id = pm.id
  WHERE s.id = ?
`;

export function createScheduledRepo(db: Database) {
  return {
    getByUserId(userId: number): ScheduledTransaction[] {
      return db
        .prepare<[number], ScheduledTransaction>(
          `
        SELECT s.id,
               s.user_id,
               s.account_id,
               s.to_account_id,
               s.type,
               s.amount,
               s.description,
               s.subcategory_id,
               s.payment_method_id,
               s.notes,
               s.recurrence_unit,
               s.recurrence_interval,
               s.recurrence_day,
               s.recurrence_month,
               s.weekend_handling,
               s.start_date,
               s.end_date,
               s.active,
               s.last_generated_until,
               s.created_at,
               a.name                as account_name,
               sc.category_id,
               COALESCE(c.name, '')  as category,
               COALESCE(sc.name, '') as subcategory,
               COALESCE(pm.name, '') as payment_method
        FROM scheduled_transactions s
               JOIN accounts a ON s.account_id = a.id
               LEFT JOIN subcategories sc ON s.subcategory_id = sc.id
               LEFT JOIN categories c ON sc.category_id = c.id
               LEFT JOIN payment_methods pm ON s.payment_method_id = pm.id
        WHERE s.user_id = ?
        ORDER BY s.created_at DESC
      `,
        )
        .all(userId);
    },

    getById(id: number, userId: number): ScheduledTransaction | undefined {
      if (
        !db
          .prepare('SELECT id FROM scheduled_transactions WHERE id = ? AND user_id = ?')
          .get(id, userId)
      )
        return undefined;
      return db.prepare<[number], ScheduledTransaction>(SCHED_WITH_DETAILS).get(id) ?? undefined;
    },

    exists(id: number, userId: number): boolean {
      return !!db
        .prepare('SELECT id FROM scheduled_transactions WHERE id = ? AND user_id = ?')
        .get(id, userId);
    },

    getTransferPmId(): number | undefined {
      return db
        .prepare<[], { id: number }>(
          `SELECT id
                                             FROM payment_methods
                                             WHERE name = 'Transfert'`,
        )
        .get()?.id;
    },

    create(userId: number, data: CreateScheduledInput) {
      return db
        .prepare(
          `
        INSERT INTO scheduled_transactions
        (user_id, account_id, to_account_id, type, amount, description, subcategory_id, payment_method_id, notes,
         recurrence_unit, recurrence_interval, recurrence_day, recurrence_month,
         weekend_handling, start_date, end_date, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          userId,
          data.account_id,
          data.to_account_id,
          data.type,
          data.amount,
          data.description,
          data.subcategory_id,
          data.payment_method_id,
          data.notes,
          data.recurrence_unit,
          data.recurrence_interval,
          data.recurrence_day,
          data.recurrence_month,
          data.weekend_handling,
          data.start_date,
          data.end_date,
          data.active ? 1 : 0,
        );
    },

    update(userId: number, id: number, data: CreateScheduledInput) {
      const today = new Date().toISOString().split('T')[0];
      db.transaction(() => {
        db.prepare(
          'DELETE FROM transactions WHERE scheduled_id = ? AND user_id = ? AND date > ? AND validated = 0',
        ).run(id, userId, today);
        db.prepare(
          `
          UPDATE scheduled_transactions
          SET account_id           = ?,
              to_account_id        = ?,
              type                 = ?,
              amount               = ?,
              description          = ?,
              subcategory_id       = ?,
              payment_method_id    = ?,
              notes                = ?,
              recurrence_unit      = ?,
              recurrence_interval  = ?,
              recurrence_day       = ?,
              recurrence_month     = ?,
              weekend_handling     = ?,
              start_date           = ?,
              end_date             = ?,
              active               = ?,
              last_generated_until = NULL
          WHERE id = ?
            AND user_id = ?
        `,
        ).run(
          data.account_id,
          data.to_account_id,
          data.type,
          data.amount,
          data.description,
          data.subcategory_id,
          data.payment_method_id,
          data.notes,
          data.recurrence_unit,
          data.recurrence_interval,
          data.recurrence_day,
          data.recurrence_month,
          data.weekend_handling,
          data.start_date,
          data.end_date,
          data.active ? 1 : 0,
          id,
          userId,
        );
      })();
    },

    delete(userId: number, id: number) {
      const today = new Date().toISOString().split('T')[0];
      db.transaction(() => {
        db.prepare(
          'DELETE FROM transactions WHERE scheduled_id = ? AND user_id = ? AND date > ? AND validated = 0',
        ).run(id, userId, today);
        db.prepare('DELETE FROM scheduled_transactions WHERE id = ? AND user_id = ?').run(
          id,
          userId,
        );
      })();
    },
  };
}
