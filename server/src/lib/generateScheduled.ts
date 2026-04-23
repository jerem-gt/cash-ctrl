import type BetterSqlite3 from 'better-sqlite3';
import { db as defaultDb } from '../db.js';
import type { ScheduledTransaction } from '../db.js';
import { dateStr, parseDate, applyWeekend, getFirstOccurrence, nextOccurrence } from './scheduledLogic.js';

type Db = BetterSqlite3.Database;
type Stmt = BetterSqlite3.Statement;

function insertTransfer(
  sched: ScheduledTransaction,
  actualDateStr: string,
  insertTx: Stmt,
  setPeer: Stmt,
  transferCategoryId: number,
  transferPmId: number,
): void {
  const expenseId = Number(insertTx.run(
    sched.user_id, sched.account_id, 'expense', sched.amount,
    sched.description, transferCategoryId, actualDateStr, transferPmId, sched.notes, sched.id,
  ).lastInsertRowid);

  const incomeId = Number(insertTx.run(
    sched.user_id, sched.to_account_id!, 'income', sched.amount,
    sched.description, transferCategoryId, actualDateStr, transferPmId, sched.notes, sched.id,
  ).lastInsertRowid);

  setPeer.run(incomeId, expenseId);
  setPeer.run(expenseId, incomeId);
}

function generateForSchedule(
  sched: ScheduledTransaction,
  horizon: Date,
  insertTx: Stmt,
  updateLastGen: Stmt,
  setPeer: Stmt,
  txDb: Db,
  transferCategoryId: number | undefined,
  transferPmId: number | undefined,
): void {
  let nominal: Date;

  if (sched.last_generated_until) {
    nominal = nextOccurrence(parseDate(sched.last_generated_until), sched);
  } else {
    nominal = getFirstOccurrence(sched);
  }

  const endDate = sched.end_date ? parseDate(sched.end_date) : null;
  const isTransfer = sched.payment_method_id === transferPmId && sched.to_account_id != null;
  let lastNominal: string | null = null;

  txDb.transaction(() => {
    while (nominal <= horizon) {
      if (endDate && nominal > endDate) break;

      const actual = applyWeekend(nominal, sched.weekend_handling);
      const actualStr = dateStr(actual);

      if (isTransfer && transferCategoryId && transferPmId) {
        insertTransfer(sched, actualStr, insertTx, setPeer, transferCategoryId, transferPmId);
      } else if (!isTransfer) {
        insertTx.run(
          sched.user_id, sched.account_id, sched.type, sched.amount,
          sched.description, sched.category_id, actualStr,
          sched.payment_method_id, sched.notes, sched.id,
        );
      }

      lastNominal = dateStr(nominal);
      nominal = nextOccurrence(nominal, sched);
    }

    if (lastNominal) {
      updateLastGen.run(lastNominal, sched.id);
    }
  })();
}

export function generateScheduledTransactions(
  userId: number,
  database: Db = defaultDb as Db,
): void {
  const settings = database.prepare('SELECT lead_days FROM user_settings WHERE user_id = ?').get(userId) as { lead_days: number } | undefined;
  const leadDays = settings?.lead_days ?? 30;

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + leadDays);

  const transferCat = database.prepare(`SELECT id FROM categories WHERE name = 'Transfert'`).get() as { id: number } | undefined;
  const transferPm  = database.prepare(`SELECT id FROM payment_methods WHERE name = 'Transfert'`).get() as { id: number } | undefined;

  const schedules = database.prepare(
    'SELECT * FROM scheduled_transactions WHERE user_id = ? AND active = 1',
  ).all(userId) as ScheduledTransaction[];

  const insertTx = database.prepare(`
    INSERT INTO transactions
      (user_id, account_id, type, amount, description, category_id, date, payment_method_id, notes, scheduled_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateLastGen = database.prepare(
    'UPDATE scheduled_transactions SET last_generated_until = ? WHERE id = ?',
  );

  const setPeer = database.prepare(
    'UPDATE transactions SET transfer_peer_id = ? WHERE id = ?',
  );

  for (const sched of schedules) {
    generateForSchedule(sched, horizon, insertTx, updateLastGen, setPeer, database, transferCat?.id, transferPm?.id);
  }
}
