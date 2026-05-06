import type BetterSqlite3 from 'better-sqlite3';

import { ScheduledTransaction } from '../modules/scheduled/scheduled.types';
import { createTransactionsRepo } from '../modules/transactions/transactions.repo.js';
import { createTransfersRepo } from '../modules/transfers/transfers.repo.js';
import {
  applyWeekend,
  dateStr,
  getFirstOccurrence,
  nextOccurrence,
  parseDate,
} from './scheduledLogic.js';

type Db = BetterSqlite3.Database;

function insertTransfer(
  sched: ScheduledTransaction,
  actualDateStr: string,
  transferSubcategoryId: number,
  transferPmId: number,
  txRepo: ReturnType<typeof createTransactionsRepo>,
  transfersRepo: ReturnType<typeof createTransfersRepo>,
): void {
  const expenseId = txRepo.createScheduled(sched.user_id, {
    account_id: sched.account_id,
    type: 'expense',
    amount: sched.amount,
    description: sched.description,
    subcategory_id: transferSubcategoryId,
    date: actualDateStr,
    payment_method_id: transferPmId,
    notes: sched.notes,
    scheduled_id: sched.id,
  });

  const incomeId = txRepo.createScheduled(sched.user_id, {
    account_id: sched.to_account_id!,
    type: 'income',
    amount: sched.amount,
    description: sched.description,
    subcategory_id: transferSubcategoryId,
    date: actualDateStr,
    payment_method_id: transferPmId,
    notes: sched.notes,
    scheduled_id: sched.id,
  });

  transfersRepo.linkTransferPeers(expenseId, incomeId);
}

function generateForSchedule(
  sched: ScheduledTransaction,
  horizon: Date,
  updateLastGen: BetterSqlite3.Statement,
  txDb: Db,
  transferSubcategoryId: number | undefined,
  transferPmId: number | undefined,
  txRepo: ReturnType<typeof createTransactionsRepo>,
  transfersRepo: ReturnType<typeof createTransfersRepo>,
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

      if (isTransfer && transferSubcategoryId && transferPmId) {
        insertTransfer(
          sched,
          actualStr,
          transferSubcategoryId,
          transferPmId,
          txRepo,
          transfersRepo,
        );
      } else if (!isTransfer) {
        txRepo.createScheduled(sched.user_id, {
          account_id: sched.account_id,
          type: sched.type,
          amount: sched.amount,
          description: sched.description,
          subcategory_id: sched.subcategory_id!,
          date: actualStr,
          payment_method_id: sched.payment_method_id!,
          notes: sched.notes,
          scheduled_id: sched.id,
        });
      }

      lastNominal = dateStr(nominal);
      nominal = nextOccurrence(nominal, sched);
    }

    if (lastNominal) {
      updateLastGen.run(lastNominal, sched.id);
    }
  })();
}

function generateLoanInstallments(userId: number, db: Db, horizon: Date): void {
  const horizonStr = dateStr(horizon);

  const transferSubcat = db
    .prepare<[], { id: number }>(`SELECT id FROM subcategories WHERE name = 'Transfert'`)
    .get();
  const prelevementPm = db
    .prepare<[], { id: number }>(`SELECT id FROM payment_methods WHERE name = 'Prélèvement'`)
    .get();

  const loans = db
    .prepare<
      [number],
      { id: number; account_id: number; source_account_id: number; account_name: string }
    >(
      `SELECT l.id, l.account_id, l.source_account_id, a.name AS account_name
       FROM loans l
       JOIN accounts a ON l.account_id = a.id
       WHERE l.user_id = ? AND a.closed_at IS NULL`,
    )
    .all(userId);

  const getPending = db.prepare<
    [number, string],
    { id: number; installment_number: number; due_date: string; total_amount: number }
  >(
    `SELECT id, installment_number, due_date, total_amount
     FROM loan_installments
     WHERE loan_id = ? AND due_date <= ? AND transaction_id IS NULL
     ORDER BY installment_number`,
  );

  const insertTx = db.prepare(
    `INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, validated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  );
  const setPeer = db.prepare('UPDATE transactions SET transfer_peer_id = ? WHERE id = ?');
  const setTxId = db.prepare('UPDATE loan_installments SET transaction_id = ? WHERE id = ?');

  for (const loan of loans) {
    const pending = getPending.all(loan.id, horizonStr);
    if (pending.length === 0) continue;

    db.transaction(() => {
      for (const inst of pending) {
        const desc = `Mensualité n°${inst.installment_number} — ${loan.account_name}`;

        const expId = Number(
          insertTx.run(
            userId,
            loan.source_account_id,
            'expense',
            inst.total_amount,
            desc,
            transferSubcat?.id ?? null,
            inst.due_date,
            prelevementPm?.id ?? null,
          ).lastInsertRowid,
        );

        const incId = Number(
          insertTx.run(
            userId,
            loan.account_id,
            'income',
            inst.total_amount,
            desc,
            transferSubcat?.id ?? null,
            inst.due_date,
            prelevementPm?.id ?? null,
          ).lastInsertRowid,
        );

        setPeer.run(incId, expId);
        setPeer.run(expId, incId);
        setTxId.run(incId, inst.id);
      }
    })();
  }
}

export function generateScheduledTransactions(userId: number, database: Db): void {
  const settings = database
    .prepare('SELECT lead_days FROM user_settings WHERE user_id = ?')
    .get(userId) as { lead_days: number } | undefined;
  const leadDays = settings?.lead_days ?? 30;

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + leadDays);

  const transferSubcat = database
    .prepare(`SELECT id FROM subcategories WHERE name = 'Transfert'`)
    .get() as { id: number } | undefined;
  const transferPm = database
    .prepare(`SELECT id FROM payment_methods WHERE name = 'Transfert'`)
    .get() as { id: number } | undefined;

  const schedules = database
    .prepare('SELECT * FROM scheduled_transactions WHERE user_id = ? AND active = 1')
    .all(userId) as ScheduledTransaction[];

  const updateLastGen = database.prepare(
    'UPDATE scheduled_transactions SET last_generated_until = ? WHERE id = ?',
  );

  const txRepo = createTransactionsRepo(database);
  const transfersRepo = createTransfersRepo(database);

  for (const sched of schedules) {
    generateForSchedule(
      sched,
      horizon,
      updateLastGen,
      database,
      transferSubcat?.id,
      transferPm?.id,
      txRepo,
      transfersRepo,
    );
  }

  generateLoanInstallments(userId, database, horizon);
}
