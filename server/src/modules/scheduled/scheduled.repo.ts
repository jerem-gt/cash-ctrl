import type { Database } from 'better-sqlite3';

import { toCents, toEuros } from '../../lib/money';
import type { CreateScheduledInput, ScheduledTransaction } from './scheduled.types';

function mapScheduled(row: ScheduledTransaction): ScheduledTransaction {
  return { ...row, amount: toEuros(row.amount) };
}

const SCHED_COLUMS = `
  s.id, s.user_id, s.account_id, s.to_account_id, s.type, s.amount, s.description,
  s.subcategory_id, s.payment_method_id, s.notes,
  s.recurrence_unit, s.recurrence_interval, s.recurrence_day, s.recurrence_month,
  s.weekend_handling, s.start_date, s.end_date, s.active, s.last_generated_until, s.created_at
`;

const GET_SQL = `
  SELECT ${SCHED_COLUMS}, a.name as account_name, sc.category_id,
         COALESCE(c.name, '') as category,
         COALESCE(sc.name, '') as subcategory,
         COALESCE(pm.name, '') as payment_method
  FROM scheduled_transactions s
  JOIN accounts a ON s.account_id = a.id
  LEFT JOIN subcategories sc ON s.subcategory_id = sc.id
  LEFT JOIN categories c ON sc.category_id = c.id
  LEFT JOIN payment_methods pm ON s.payment_method_id = pm.id
`;

const GET_BY_USER_ID_SQL = `
  ${GET_SQL}
  WHERE s.user_id = :userId
  ORDER BY s.created_at DESC
`;

const GET_BY_ID_SQL = `
  ${GET_SQL}
  WHERE s.id = :id
  AND s.user_id = :userId
`;

export function createScheduledRepo(db: Database) {
  const getActiveByUserIdStmt = db.prepare<{ userId: number }, ScheduledTransaction>(
    'SELECT * FROM scheduled_transactions WHERE user_id = :userId AND active = 1',
  );
  const getByUserIdStmt = db.prepare(GET_BY_USER_ID_SQL);
  const getByIdStmt = db.prepare(GET_BY_ID_SQL);
  const existsStmt = db.prepare(
    'SELECT 1 FROM scheduled_transactions WHERE id = :id AND user_id = :userId',
  );
  const deleteFutureTransactionsStmt = db.prepare(
    'DELETE FROM transactions WHERE scheduled_id = :id AND user_id = :userId AND date > :today AND validated = 0',
  );
  const deleteScheduledStmt = db.prepare(
    'DELETE FROM scheduled_transactions WHERE id = :id AND user_id = :userId',
  );

  const insertStmt = db.prepare(`
    INSERT INTO scheduled_transactions
    (user_id, account_id, to_account_id, type, amount, description, subcategory_id, payment_method_id, notes,
     recurrence_unit, recurrence_interval, recurrence_day, recurrence_month,
     weekend_handling, start_date, end_date, active)
    VALUES (:user_id, :account_id, :to_account_id, :type, :amount, :description, :subcategory_id, :payment_method_id, :notes,
            :recurrence_unit, :recurrence_interval, :recurrence_day, :recurrence_month,
            :weekend_handling, :start_date, :end_date, :active)
  `);

  const updateStmt = db.prepare(`
    UPDATE scheduled_transactions
    SET account_id           = :account_id,
        to_account_id        = :to_account_id,
        type                 = :type,
        amount               = :amount,
        description          = :description,
        subcategory_id       = :subcategory_id,
        payment_method_id    = :payment_method_id,
        notes                = :notes,
        recurrence_unit      = :recurrence_unit,
        recurrence_interval  = :recurrence_interval,
        recurrence_day       = :recurrence_day,
        recurrence_month     = :recurrence_month,
        weekend_handling     = :weekend_handling,
        start_date           = :start_date,
        end_date             = :end_date,
        active               = :active,
        last_generated_until = NULL
    WHERE id = :id
    AND user_id = :user_id
  `);

  const updateLastGeneratedUntilStmt = db.prepare(`
    UPDATE scheduled_transactions SET last_generated_until = :lastGeneratedUntil WHERE id = :id
  `);

  return {
    getActiveByUserId: (userId: number) => getActiveByUserIdStmt.all({ userId }).map(mapScheduled),
    getByUserId: (userId: number) =>
      (getByUserIdStmt.all({ userId }) as ScheduledTransaction[]).map(mapScheduled),
    getById: (id: number, userId: number) => {
      const row = getByIdStmt.get({ id, userId }) as ScheduledTransaction | undefined;
      return row ? mapScheduled(row) : undefined;
    },
    exists: (id: number, userId: number) => !!existsStmt.get({ id, userId }),

    create(userId: number, data: CreateScheduledInput) {
      return insertStmt.run({
        ...data,
        amount: toCents(data.amount),
        user_id: userId,
        active: data.active ? 1 : 0,
      });
    },

    update(id: number, userId: number, data: CreateScheduledInput) {
      const today = new Date().toISOString().split('T')[0];
      const runUpdate = db.transaction(() => {
        deleteFutureTransactionsStmt.run({ id, userId, today });
        updateStmt.run({
          ...data,
          amount: toCents(data.amount),
          id: id,
          user_id: userId,
          active: data.active ? 1 : 0,
        });
      });
      return runUpdate();
    },

    updateLastGeneratedUntil(id: number, lastGeneratedUntil: string) {
      updateLastGeneratedUntilStmt.run({ id, lastGeneratedUntil });
    },

    delete(userId: number, id: number) {
      const today = new Date().toISOString().split('T')[0];
      const runDelete = db.transaction(() => {
        deleteFutureTransactionsStmt.run({ id, userId, today });
        deleteScheduledStmt.run({ id, userId });
      });
      return runDelete();
    },
  };
}
