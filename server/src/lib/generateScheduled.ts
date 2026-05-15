import type BetterSqlite3 from 'better-sqlite3';

import { createLoansRepo } from '../modules/loans/loans.repo';
import { createScheduledRepo } from '../modules/scheduled/scheduled.repo';
import { ScheduledTransaction } from '../modules/scheduled/scheduled.types';
import { createSettingsRepo } from '../modules/settings/settings.repo';
import { createTransactionsRepo } from '../modules/transactions/transactions.repo.js';
import { createTransfersRepo } from '../modules/transfers/transfers.repo.js';
import {
  getBankFeesSubcategoryId,
  getPrelevementPaymentMethodId,
} from './administrationDataConstants.js';
import { toCents } from './money.js';
import {
  applyWeekend,
  dateStr,
  getFirstOccurrence,
  nextOccurrence,
  parseDate,
} from './scheduledLogic.js';

type Db = BetterSqlite3.Database;

function generateInsuranceVersement(
  db: Db,
  userId: number,
  sched: ScheduledTransaction,
  actualStr: string,
): void {
  const amountCents = toCents(sched.amount);
  const feesCents = toCents(sched.insurance_fees);

  const txResult = db
    .prepare(
      `INSERT INTO transactions (user_id, account_id, type, amount, description, date, validated, scheduled_id)
       VALUES (?, ?, 'expense', ?, ?, ?, 0, ?)`,
    )
    .run(userId, sched.to_account_id!, amountCents, sched.description, actualStr, sched.id);
  const transactionId = Number(txResult.lastInsertRowid);

  let feesTransactionId: number | null = null;
  if (feesCents > 0) {
    const subcategoryId = getBankFeesSubcategoryId(db, userId) ?? null;
    const paymentMethodId = getPrelevementPaymentMethodId(db, userId) ?? null;
    const feesResult = db
      .prepare(
        `INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, validated)
         VALUES (?, ?, 'expense', ?, ?, ?, ?, ?, 1)`,
      )
      .run(
        userId,
        sched.to_account_id!,
        feesCents,
        `Frais — ${sched.description}`,
        subcategoryId,
        actualStr,
        paymentMethodId,
      );
    feesTransactionId = Number(feesResult.lastInsertRowid);
  }

  db.prepare(
    `INSERT INTO insurance_operations
       (user_id, account_id, support_id, transaction_id, fees_transaction_id, type, amount, fees, date)
     VALUES (?, ?, ?, ?, ?, 'versement', ?, ?, ?)`,
  ).run(
    userId,
    sched.account_id,
    sched.insurance_support_id!,
    transactionId,
    feesTransactionId,
    amountCents,
    feesCents,
    actualStr,
  );
}

function generateForSchedule(
  sched: ScheduledTransaction,
  horizon: Date,
  txDb: Db,
  txRepo: ReturnType<typeof createTransactionsRepo>,
  transfersRepo: ReturnType<typeof createTransfersRepo>,
  scheduledRepo: ReturnType<typeof createScheduledRepo>,
): void {
  let nominal: Date;

  if (sched.last_generated_until) {
    nominal = nextOccurrence(parseDate(sched.last_generated_until), sched);
  } else {
    nominal = getFirstOccurrence(sched);
  }

  const endDate = sched.end_date ? parseDate(sched.end_date) : null;
  const isVersement = sched.insurance_support_id != null;
  const isTransfer = !isVersement && sched.to_account_id != null;
  let lastNominal: string | null = null;

  txDb.transaction(() => {
    while (nominal <= horizon) {
      if (endDate && nominal > endDate) break;

      const actual = applyWeekend(nominal, sched.weekend_handling);
      const actualStr = dateStr(actual);

      if (isVersement) {
        generateInsuranceVersement(txDb, sched.user_id, sched, actualStr);
      } else if (isTransfer) {
        transfersRepo.create(sched.user_id, {
          amount: sched.amount,
          date: actualStr,
          description: sched.description,
          from_account_id: sched.account_id,
          notes: sched.notes,
          to_account_id: sched.to_account_id!,
          scheduled_id: sched.id,
        });
      } else {
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
      scheduledRepo.updateLastGeneratedUntil(sched.id, lastNominal);
    }
  })();
}

function generateLoanInstallments(
  userId: number,
  db: Db,
  horizon: Date,
  transfersRepo: ReturnType<typeof createTransfersRepo>,
): void {
  const horizonStr = dateStr(horizon);

  const loansRepo = createLoansRepo(db);
  const loans = loansRepo.getAllActiveByUserId(userId);

  for (const loan of loans) {
    const pending = loansRepo.getPendingInstallments(loan.id, horizonStr);
    if (pending.length === 0) continue;

    db.transaction(() => {
      for (const inst of pending) {
        const desc = `Mensualité n°${inst.installment_number} — ${loan.account_name}`;

        const transferTxs = transfersRepo.create(userId, {
          amount: inst.total_amount,
          date: inst.due_date,
          description: desc,
          from_account_id: loan.source_account_id,
          to_account_id: loan.account_id,
        });

        loansRepo.updateInstallmentTxId(inst.id, transferTxs.income.id);
      }
    })();
  }
}

export function generateScheduledTransactions(userId: number, database: Db): void {
  const settingsRepo = createSettingsRepo(database);
  const userSettings = settingsRepo.get(userId);
  const leadDays = userSettings.lead_days ?? 30;

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + leadDays);

  const scheduledRepo = createScheduledRepo(database);
  const schedules = scheduledRepo.getActiveByUserId(userId);

  const txRepo = createTransactionsRepo(database);
  const transfersRepo = createTransfersRepo(database);

  for (const sched of schedules) {
    generateForSchedule(sched, horizon, database, txRepo, transfersRepo, scheduledRepo);
  }

  generateLoanInstallments(userId, database, horizon, transfersRepo);
}
