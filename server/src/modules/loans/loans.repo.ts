import type { Database } from 'better-sqlite3';

import { getAccountTypeIds } from '../../lib/administrationDataConstants';
import type {
  CreateLoanInput,
  Loan,
  LoanInstallment,
  UpdateInstallmentInput,
  UpdateLoanInput,
} from './loans.types.js';

function addMonths(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1 + n, 1);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(d, maxDay);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function calcMonthlyPayment(principal: number, annualRate: number, months: number): number {
  if (annualRate === 0) return Math.round((principal / months) * 100) / 100;
  const r = annualRate / 12;
  const payment = (principal * r * (1 + r) ** months) / ((1 + r) ** months - 1);
  return Math.round(payment * 100) / 100;
}

function buildSchedule(
  principal: number,
  annualRate: number,
  months: number,
  startDate: string,
  monthlyPayment: number,
) {
  const r = annualRate / 12;
  let remaining = principal;
  return Array.from({ length: months }, (_, i) => {
    const n = i + 1;
    const interestAmt = Math.round(remaining * r * 100) / 100;
    const isLast = n === months;
    const principalAmt = isLast
      ? remaining
      : Math.round((monthlyPayment - interestAmt) * 100) / 100;
    const totalAmt = isLast ? Math.round((remaining + interestAmt) * 100) / 100 : monthlyPayment;
    remaining = Math.round((remaining - principalAmt) * 100) / 100;
    return {
      installment_number: n,
      due_date: addMonths(startDate, i),
      total_amount: totalAmt,
      principal_amount: principalAmt,
      interest_amount: interestAmt,
    };
  });
}

export function createLoansRepo(db: Database) {
  const getByAccountIdStmt = db.prepare<{ accountId: number; userId: number }, Loan>(
    'SELECT * FROM loans WHERE account_id = :accountId AND user_id = :userId',
  );
  const getInstallmentsByLoanId = db.prepare<{ userId: number; loanId: number }, LoanInstallment>(
    `SELECT li.*,
        CASE WHEN li.transaction_id IS NOT NULL THEN t.validated END AS transaction_validated
     FROM loan_installments li
     LEFT JOIN transactions t ON li.transaction_id = t.id
     JOIN loans l ON li.loan_id = l.id
     WHERE li.loan_id = :loanId AND l.user_id = :userId
     ORDER BY li.installment_number`,
  );
  const getInstallmentById = db.prepare<{ id: number }, LoanInstallment>(
    `SELECT li.*,
        CASE WHEN li.transaction_id IS NOT NULL THEN t.validated END AS transaction_validated
     FROM loan_installments li
     LEFT JOIN transactions t ON li.transaction_id = t.id
     WHERE li.id = :id`,
  );
  const getLoanById = db.prepare<{ id: number }, Loan>('SELECT * FROM loans WHERE id = :id');
  const getAllActiveByUserIdStmt = db.prepare<
    { userId: number },
    { id: number; account_id: number; source_account_id: number; account_name: string }
  >(
    `SELECT l.id, l.account_id, l.source_account_id, a.name AS account_name
     FROM loans l
     JOIN accounts a ON l.account_id = a.id
     WHERE l.user_id = :userId AND a.closed_at IS NULL`,
  );
  const getAllPendingInstallmentsStmt = db.prepare<
    { loanId: number; dueDate: string },
    LoanInstallment
  >(
    `SELECT id, installment_number, due_date, total_amount
     FROM loan_installments
     WHERE loan_id = :loanId AND due_date <= :dueDate AND transaction_id IS NULL
     ORDER BY installment_number`,
  );

  const updateInstallmentTxIdStmt = db.prepare(
    'UPDATE loan_installments SET transaction_id = :txId WHERE id = :id',
  );

  // Pour create()
  const insertAccountStmt = db.prepare(
    `INSERT INTO accounts (user_id, name, bank_id, account_type_id, initial_balance, opening_date)
    VALUES (:userId, :name, :bankId, :accountTypeId, :initialBalance, :openingDate)`,
  );
  const insertLoanStmt = db.prepare(
    `INSERT INTO loans (account_id, user_id, principal_amount, interest_rate, duration_months, start_date, monthly_payment, source_account_id)
    VALUES (:account_id, :user_id, :principal_amount, :interest_rate, :duration_months, :start_date, :monthly_payment, :source_account_id)`,
  );
  const insertInstallmentStmt = db.prepare(
    `INSERT INTO loan_installments (user_id, loan_id, installment_number, due_date, total_amount, principal_amount, interest_amount)
    VALUES (:user_id, :loan_id, :installment_number, :due_date, :total_amount, :principal_amount, :interest_amount)`,
  );

  // Pour updateLoan()
  const updateAccountBasicStmt = db.prepare(
    'UPDATE accounts SET name = :name, bank_id = :bankId, opening_date = :openingDate WHERE id = :id',
  );
  const updateLoanSourceStmt = db.prepare(
    'UPDATE loans SET source_account_id = :sourceAccountId WHERE id = :id',
  );
  const updateLinkedTransactionsStmt = db.prepare(
    `UPDATE transactions SET account_id = :accountId
     WHERE id IN (
       SELECT t.transfer_peer_id
       FROM loan_installments li
       JOIN transactions t ON li.transaction_id = t.id
       WHERE li.loan_id = :loanId AND t.validated = 0 AND t.transfer_peer_id IS NOT NULL
     ) AND validated = 0`,
  );

  // Pour updateInstallment()
  const getInstallmentFullStmt = db.prepare<
    { installmentId: number; loanId: number; userId: number },
    LoanInstallment & { account_id: number; source_account_id: number }
  >(
    `SELECT li.*, l.account_id, l.source_account_id
     FROM loan_installments li
     JOIN loans l ON li.loan_id = l.id
     WHERE li.id = :installmentId AND l.id = :loanId AND l.user_id = :userId`,
  );
  const updateInstallmentBasicStmt = db.prepare(
    'UPDATE loan_installments SET due_date = :dueDate, total_amount = :totalAmount WHERE id = :id',
  );
  const updateTransactionStmt = db.prepare(
    'UPDATE transactions SET date = :date, amount = :amount WHERE id = :id AND user_id = :userId',
  );
  const getTransferPeerIdStmt = db
    .prepare('SELECT transfer_peer_id AS id FROM transactions WHERE id = :id')
    .pluck();

  return {
    getAllActiveByUserId: (userId: number) => getAllActiveByUserIdStmt.all({ userId }),
    getPendingInstallments: (loanId: number, dueDate: string) =>
      getAllPendingInstallmentsStmt.all({ loanId, dueDate }),

    create(userId: number, data: CreateLoanInput): Loan {
      const accountTypeId = getAccountTypeIds(db, userId).atPretId;
      if (!accountTypeId) {
        throw new Error("Type de compte 'Prêt' introuvable");
      }

      const monthlyPayment = calcMonthlyPayment(
        data.principal_amount,
        data.interest_rate,
        data.duration_months,
      );
      const schedule = buildSchedule(
        data.principal_amount,
        data.interest_rate,
        data.duration_months,
        data.start_date,
        monthlyPayment,
      );

      return db.transaction(() => {
        const accountResult = insertAccountStmt.run({
          userId,
          name: data.name,
          bankId: data.bank_id,
          accountTypeId,
          initialBalance: -data.principal_amount,
          openingDate: data.opening_date,
        });
        const accountId = Number(accountResult.lastInsertRowid);

        const loanResult = insertLoanStmt.run({
          ...data,
          account_id: accountId,
          user_id: userId,
          monthly_payment: monthlyPayment,
        });
        const loanId = Number(loanResult.lastInsertRowid);

        for (const row of schedule) {
          insertInstallmentStmt.run({
            ...row,
            loan_id: loanId,
            user_id: userId,
          });
        }

        return getLoanById.get({ id: loanId })!;
      })();
    },

    getByAccountId: (accountId: number, userId: number) =>
      getByAccountIdStmt.get({ accountId, userId }),

    getInstallments: (loanId: number, userId: number) =>
      getInstallmentsByLoanId.all({ loanId, userId }),

    updateLoan(userId: number, loanId: number, data: UpdateLoanInput): Loan | null {
      const loan = getLoanById.get({ id: loanId });
      if (!loan) {
        return null;
      }

      return db.transaction(() => {
        updateAccountBasicStmt.run({
          name: data.name,
          bankId: data.bank_id,
          openingDate: data.opening_date,
          id: loan.account_id,
        });

        updateLoanSourceStmt.run({
          sourceAccountId: data.source_account_id,
          id: loanId,
        });

        if (data.source_account_id !== loan.source_account_id) {
          updateLinkedTransactionsStmt.run({
            accountId: data.source_account_id,
            loanId,
          });
        }

        return getLoanById.get({ id: loanId })!;
      })();
    },

    updateInstallment(
      userId: number,
      loanId: number,
      installmentId: number,
      data: UpdateInstallmentInput,
    ): LoanInstallment | null {
      const row = getInstallmentFullStmt.get({
        installmentId,
        loanId,
        userId,
      });
      if (!row) {
        return null;
      }

      return db.transaction(() => {
        updateInstallmentBasicStmt.run({
          dueDate: data.due_date,
          totalAmount: data.total_amount,
          id: installmentId,
        });

        if (row.transaction_id) {
          updateTransactionStmt.run({
            date: data.due_date,
            amount: data.total_amount,
            id: row.transaction_id,
            userId,
          });

          const peerId = getTransferPeerIdStmt.get({ id: row.transaction_id });
          if (peerId) {
            updateTransactionStmt.run({
              date: data.due_date,
              amount: data.total_amount,
              id: peerId,
              userId,
            });
          }
        }

        return getInstallmentById.get({ id: installmentId })!;
      })();
    },

    updateInstallmentTxId: (id: number, txId: number) =>
      updateInstallmentTxIdStmt.run({ id, txId }),
  };
}
