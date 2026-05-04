import type { Database } from 'better-sqlite3';

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
  return {
    create(userId: number, data: CreateLoanInput): Loan {
      const accountType = db
        .prepare<[], { id: number }>(`SELECT id FROM account_types WHERE name = 'Prêt'`)
        .get();
      if (!accountType) throw new Error("Type de compte 'Prêt' introuvable");

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
        const accountResult = db
          .prepare(
            'INSERT INTO accounts (user_id, name, bank_id, account_type_id, initial_balance, opening_date) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(
            userId,
            data.name,
            data.bank_id,
            accountType.id,
            -data.principal_amount,
            data.opening_date,
          );

        const accountId = Number(accountResult.lastInsertRowid);

        const loanResult = db
          .prepare(
            'INSERT INTO loans (account_id, user_id, principal_amount, interest_rate, duration_months, start_date, monthly_payment, source_account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .run(
            accountId,
            userId,
            data.principal_amount,
            data.interest_rate,
            data.duration_months,
            data.start_date,
            monthlyPayment,
            data.source_account_id,
          );

        const loanId = Number(loanResult.lastInsertRowid);

        const insertInstallment = db.prepare(
          'INSERT INTO loan_installments (loan_id, installment_number, due_date, total_amount, principal_amount, interest_amount) VALUES (?, ?, ?, ?, ?, ?)',
        );
        for (const row of schedule) {
          insertInstallment.run(
            loanId,
            row.installment_number,
            row.due_date,
            row.total_amount,
            row.principal_amount,
            row.interest_amount,
          );
        }

        return db.prepare<[number], Loan>('SELECT * FROM loans WHERE id = ?').get(loanId)!;
      })();
    },

    getByAccountId(accountId: number, userId: number): Loan | undefined {
      return (
        db
          .prepare<
            [number, number],
            Loan
          >('SELECT * FROM loans WHERE account_id = ? AND user_id = ?')
          .get(accountId, userId) ?? undefined
      );
    },

    getInstallments(loanId: number, userId: number): LoanInstallment[] {
      return db
        .prepare<[number, number], LoanInstallment>(
          `SELECT li.*,
                  CASE WHEN li.transaction_id IS NOT NULL THEN t.validated ELSE NULL END AS transaction_validated
           FROM loan_installments li
           LEFT JOIN transactions t ON li.transaction_id = t.id
           JOIN loans l ON li.loan_id = l.id
           WHERE li.loan_id = ? AND l.user_id = ?
           ORDER BY li.installment_number`,
        )
        .all(loanId, userId);
    },

    updateLoan(userId: number, loanId: number, data: UpdateLoanInput): Loan | null {
      const loan = db
        .prepare<
          [number, number],
          { id: number; account_id: number; source_account_id: number }
        >('SELECT id, account_id, source_account_id FROM loans WHERE id = ? AND user_id = ?')
        .get(loanId, userId);

      if (!loan) return null;

      return db.transaction(() => {
        db.prepare('UPDATE accounts SET name = ?, bank_id = ?, opening_date = ? WHERE id = ?').run(
          data.name,
          data.bank_id,
          data.opening_date,
          loan.account_id,
        );

        db.prepare('UPDATE loans SET source_account_id = ? WHERE id = ?').run(
          data.source_account_id,
          loanId,
        );

        if (data.source_account_id !== loan.source_account_id) {
          db.prepare(
            `UPDATE transactions SET account_id = ?
             WHERE id IN (
               SELECT t.transfer_peer_id
               FROM loan_installments li
               JOIN transactions t ON li.transaction_id = t.id
               WHERE li.loan_id = ? AND t.validated = 0 AND t.transfer_peer_id IS NOT NULL
             ) AND validated = 0`,
          ).run(data.source_account_id, loanId);
        }

        return db.prepare<[number], Loan>('SELECT * FROM loans WHERE id = ?').get(loanId)!;
      })();
    },

    updateInstallment(
      userId: number,
      loanId: number,
      installmentId: number,
      data: UpdateInstallmentInput,
    ): LoanInstallment | null {
      const row = db
        .prepare<
          [number, number],
          LoanInstallment & { account_id: number; source_account_id: number }
        >(
          `SELECT li.*, l.account_id, l.source_account_id
           FROM loan_installments li
           JOIN loans l ON li.loan_id = l.id
           WHERE li.id = ? AND l.id = ? AND l.user_id = ${userId}`,
        )
        .get(installmentId, loanId);

      if (!row) return null;

      return db.transaction(() => {
        db.prepare('UPDATE loan_installments SET due_date = ?, total_amount = ? WHERE id = ?').run(
          data.due_date,
          data.total_amount,
          installmentId,
        );

        if (row.transaction_id) {
          db.prepare(
            'UPDATE transactions SET date = ?, amount = ? WHERE id = ? AND user_id = ?',
          ).run(data.due_date, data.total_amount, row.transaction_id, userId);

          const peer = db
            .prepare<
              [number],
              { id: number }
            >('SELECT transfer_peer_id AS id FROM transactions WHERE id = ?')
            .get(row.transaction_id);

          if (peer?.id) {
            db.prepare(
              'UPDATE transactions SET date = ?, amount = ? WHERE id = ? AND user_id = ?',
            ).run(data.due_date, data.total_amount, peer.id, userId);
          }
        }

        return db
          .prepare<[number], LoanInstallment>(
            `SELECT li.*,
                    CASE WHEN li.transaction_id IS NOT NULL THEN t.validated ELSE NULL END AS transaction_validated
             FROM loan_installments li
             LEFT JOIN transactions t ON li.transaction_id = t.id
             WHERE li.id = ?`,
          )
          .get(installmentId)!;
      })();
    },
  };
}
