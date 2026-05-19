import type { Database } from 'better-sqlite3';

import {
  FullExport,
  FullExportAccount,
  FullExportAccountType,
  FullExportBank,
  FullExportCategory,
  FullExportInsuranceOperation,
  FullExportInsuranceSupport,
  FullExportLoan,
  FullExportLoanInstallment,
  FullExportPaymentMethod,
  FullExportScheduled,
  FullExportSplit,
  FullExportStockOperation,
  FullExportStockPosition,
  FullExportSubcategory,
  FullExportTransaction,
} from './export.types';

export function createExportRepo(db: Database) {
  return {
    getFullExport(userId: number, accountIds?: number[]): FullExport {
      const hasFilter = accountIds && accountIds.length > 0;
      const idList = hasFilter ? accountIds.join(',') : '';
      const acctIn = hasFilter ? `AND a.id IN (${idList})` : '';
      const txIn = hasFilter ? `AND t.account_id IN (${idList})` : '';
      const schedIn = hasFilter ? `AND st.account_id IN (${idList})` : '';
      const stockPosIn = hasFilter ? `AND sp.account_id IN (${idList})` : '';
      const stockOpIn = hasFilter ? `AND so.account_id IN (${idList})` : '';
      const loanIn = hasFilter ? `AND l.account_id IN (${idList})` : '';
      const insIn = hasFilter ? `AND ins.account_id IN (${idList})` : '';
      const insOpIn = hasFilter ? `AND io.account_id IN (${idList})` : '';

      const accountTypes = db
        .prepare<[number], FullExportAccountType>(
          `SELECT DISTINCT at.id, at.name, at.envelope_type
           FROM account_types at
           JOIN accounts a ON a.account_type_id = at.id
           WHERE a.user_id = ? ${acctIn}`,
        )
        .all(userId);

      const banks = db
        .prepare<[number], FullExportBank>(
          `SELECT DISTINCT b.id, b.name, b.logo, b.domain
           FROM banks b
           JOIN accounts a ON a.bank_id = b.id
           WHERE a.user_id = ? ${acctIn}`,
        )
        .all(userId);

      const accounts = db
        .prepare<[number], FullExportAccount>(
          `SELECT a.id, a.name, a.bank_id, a.account_type_id,
                  a.initial_balance, a.opening_date, a.closed_at
           FROM accounts a
           WHERE a.user_id = ? ${acctIn}`,
        )
        .all(userId);

      const categoriesRaw = db
        .prepare<
          [number],
          { id: number; name: string; icon: string }
        >(`SELECT id, name, icon FROM categories WHERE user_id = ?`)
        .all(userId);

      const subcatsRaw = db
        .prepare<
          [number],
          FullExportSubcategory & { category_id: number }
        >(`SELECT id, category_id, name FROM subcategories WHERE user_id = ?`)
        .all(userId);

      const categories: FullExportCategory[] = categoriesRaw.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        subcategories: subcatsRaw
          .filter((sc) => sc.category_id === c.id)
          .map((sc) => ({ id: sc.id, name: sc.name }) satisfies FullExportSubcategory),
      }));

      const paymentMethods = db
        .prepare<
          [number],
          FullExportPaymentMethod
        >(`SELECT id, name, icon FROM payment_methods WHERE user_id = ?`)
        .all(userId);

      const txsRaw = db
        .prepare<[number], Omit<FullExportTransaction, 'splits'>>(
          `SELECT t.id, t.account_id, t.type, t.amount, t.description,
                  t.subcategory_id, t.payment_method_id, t.date, t.validated,
                  t.notes, t.transfer_peer_id, t.reimbursement_status, t.scheduled_id
           FROM transactions t
           WHERE t.user_id = ? ${txIn}
           ORDER BY t.date, t.id`,
        )
        .all(userId);

      const splitsRaw = db
        .prepare<[number], FullExportSplit & { transaction_id: number }>(
          `SELECT ts.transaction_id, ts.subcategory_id, ts.amount
           FROM transaction_splits ts
           JOIN transactions t ON ts.transaction_id = t.id
           WHERE ts.user_id = ? ${txIn}`,
        )
        .all(userId);

      const splitsByTxId = new Map<number, FullExportSplit[]>();
      for (const s of splitsRaw) {
        const list = splitsByTxId.get(s.transaction_id) ?? [];
        list.push({ subcategory_id: s.subcategory_id, amount: s.amount });
        splitsByTxId.set(s.transaction_id, list);
      }

      const transactions: FullExportTransaction[] = txsRaw.map((t) => ({
        ...t,
        splits: splitsByTxId.get(t.id) ?? [],
      }));

      const scheduledTransactions = db
        .prepare<[number], FullExportScheduled>(
          `SELECT st.id, st.account_id, st.type, st.amount, st.description,
                  st.subcategory_id, st.payment_method_id, st.notes,
                  st.recurrence_unit, st.recurrence_interval, st.recurrence_day,
                  st.recurrence_month, st.to_account_id, st.weekend_handling,
                  st.start_date, st.end_date, st.active, st.last_generated_until
           FROM scheduled_transactions st
           WHERE st.user_id = ? ${schedIn}`,
        )
        .all(userId);

      const stockPositions = db
        .prepare<[number], FullExportStockPosition>(
          `SELECT sp.account_id, sp.ticker, sp.quantity, sp.avg_price
           FROM stock_positions sp
           WHERE sp.user_id = ? ${stockPosIn}`,
        )
        .all(userId);

      const stockOperations = db
        .prepare<[number], FullExportStockOperation>(
          `SELECT so.id, so.account_id, so.transaction_id, so.fees_transaction_id,
                  so.ticker, so.type, so.quantity, so.price_per_share, so.fees, so.date
           FROM stock_operations so
           WHERE so.user_id = ? ${stockOpIn}`,
        )
        .all(userId);

      const loansRaw = db
        .prepare<[number], Omit<FullExportLoan, 'installments'>>(
          `SELECT l.id, l.account_id, l.principal_amount, l.interest_rate,
                  l.duration_months, l.start_date, l.monthly_payment,
                  l.source_account_id, l.deposit_account_id, l.deposit_transaction_id
           FROM loans l
           WHERE l.user_id = ? ${loanIn}`,
        )
        .all(userId);

      const loanIds = loansRaw.map((l) => l.id);
      const installmentsRaw =
        loanIds.length > 0
          ? db
              .prepare<[number], FullExportLoanInstallment & { loan_id: number }>(
                `SELECT li.loan_id, li.installment_number, li.due_date,
                        li.total_amount, li.principal_amount, li.interest_amount, li.transaction_id
                 FROM loan_installments li
                 WHERE li.loan_id IN (${loanIds.join(',')}) AND li.user_id = ?`,
              )
              .all(userId)
          : [];

      const installsByLoanId = new Map<number, FullExportLoanInstallment[]>();
      for (const inst of installmentsRaw) {
        const list = installsByLoanId.get(inst.loan_id) ?? [];
        list.push({
          installment_number: inst.installment_number,
          due_date: inst.due_date,
          total_amount: inst.total_amount,
          principal_amount: inst.principal_amount,
          interest_amount: inst.interest_amount,
          transaction_id: inst.transaction_id,
        });
        installsByLoanId.set(inst.loan_id, list);
      }

      const loans: FullExportLoan[] = loansRaw.map((l) => ({
        ...l,
        installments: installsByLoanId.get(l.id) ?? [],
      }));

      const insuranceSupports = db
        .prepare<[number], FullExportInsuranceSupport>(
          `SELECT ins.id, ins.account_id, ins.name, ins.type, ins.ticker
           FROM insurance_supports ins
           WHERE ins.user_id = ? ${insIn}`,
        )
        .all(userId);

      const insuranceOperations = db
        .prepare<[number], FullExportInsuranceOperation>(
          `SELECT io.id, io.account_id, io.support_id, io.transaction_id, io.fees_transaction_id,
                  io.social_fees_transaction_id, io.type, io.amount, io.fees, io.social_fees,
                  io.date, io.arbitrage_peer_id
           FROM insurance_operations io
           WHERE io.user_id = ? ${insOpIn}
           ORDER BY io.date, io.id`,
        )
        .all(userId);

      return {
        version: '1.0',
        exported_at: new Date().toISOString(),
        amounts_in_cents: true,
        account_types: accountTypes,
        banks,
        accounts,
        categories,
        payment_methods: paymentMethods,
        transactions,
        scheduled_transactions: scheduledTransactions,
        stock_positions: stockPositions,
        stock_operations: stockOperations,
        loans,
        insurance_supports: insuranceSupports,
        insurance_operations: insuranceOperations,
      };
    },
  };
}
