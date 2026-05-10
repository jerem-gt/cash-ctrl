import type { Database } from 'better-sqlite3';

import { getTransferIds } from '../../lib/administrationDataConstants.js';
import { toCents } from '../../lib/money.js';
import type { FullExport } from '../export/export.types.js';
import type { ImportExecuteBody, ImportResult, JsonFullImportResult } from './import.types.js';

export function createImportRepo(db: Database) {
  // ── JSON full import prepared statements ──────────────────────────────────
  const findAccountTypeByName = db.prepare<[number, string], { id: number }>(
    `SELECT id FROM account_types WHERE user_id = ? AND name = ?`,
  );
  const insertAccountType = db.prepare(
    `INSERT INTO account_types (user_id, name, is_investment, is_loan) VALUES (?, ?, ?, ?)`,
  );
  const findBankByName = db.prepare<[string], { id: number }>(
    `SELECT id FROM banks WHERE name = ?`,
  );
  const insertBank = db.prepare(`INSERT INTO banks (name, logo, domain) VALUES (?, ?, ?)`);
  const findAccountByName = db.prepare<[number, string], { id: number }>(
    `SELECT id FROM accounts WHERE user_id = ? AND name = ?`,
  );
  const insertAccount = db.prepare(
    `INSERT INTO accounts (user_id, name, bank_id, account_type_id, initial_balance, opening_date, closed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const findCategoryByName = db.prepare<[number, string], { id: number }>(
    `SELECT id FROM categories WHERE user_id = ? AND name = ?`,
  );
  const insertCategory = db.prepare(
    `INSERT INTO categories (user_id, name, icon) VALUES (?, ?, ?)`,
  );
  const findSubcategoryByName = db.prepare<[number, string], { id: number }>(
    `SELECT id FROM subcategories WHERE category_id = ? AND name = ?`,
  );
  const insertSubcategory = db.prepare(
    `INSERT INTO subcategories (user_id, category_id, name) VALUES (?, ?, ?)`,
  );
  const findPaymentMethodByName = db.prepare<[number, string], { id: number }>(
    `SELECT id FROM payment_methods WHERE user_id = ? AND name = ?`,
  );
  const insertPaymentMethod = db.prepare(
    `INSERT INTO payment_methods (user_id, name, icon) VALUES (?, ?, ?)`,
  );
  const insertFullTxStmt = db.prepare(`
    INSERT INTO transactions
    (user_id, account_id, type, amount, description, subcategory_id, payment_method_id,
     date, validated, notes, reimbursement_status, scheduled_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `);
  const setFullPeerStmt = db.prepare(`UPDATE transactions SET transfer_peer_id = ? WHERE id = ?`);
  const insertSplitStmt = db.prepare(
    `INSERT INTO transaction_splits (user_id, transaction_id, subcategory_id, amount) VALUES (?, ?, ?, ?)`,
  );
  const insertScheduledStmt = db.prepare(`
    INSERT INTO scheduled_transactions
    (user_id, account_id, type, amount, description, subcategory_id, payment_method_id,
     notes, recurrence_unit, recurrence_interval, recurrence_day, recurrence_month,
     to_account_id, weekend_handling, start_date, end_date, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const upsertStockPosition = db.prepare(`
    INSERT INTO stock_positions (user_id, account_id, ticker, quantity, avg_price)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (account_id, ticker) DO UPDATE SET
      avg_price = (avg_price * quantity + excluded.avg_price * excluded.quantity) / (quantity + excluded.quantity),
      quantity = quantity + excluded.quantity,
      updated_at = datetime('now')
  `);
  const insertStockOp = db.prepare(`
    INSERT INTO stock_operations
    (user_id, account_id, transaction_id, fees_transaction_id, ticker, type, quantity, price_per_share, fees, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertLoan = db.prepare(`
    INSERT OR IGNORE INTO loans
    (account_id, user_id, principal_amount, interest_rate, duration_months, start_date,
     monthly_payment, source_account_id, deposit_account_id, deposit_transaction_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertInstallment = db.prepare(`
    INSERT OR IGNORE INTO loan_installments
    (user_id, loan_id, installment_number, due_date, total_amount, principal_amount, interest_amount, transaction_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // ── JSON full import helpers (closures over prepared statements) ─────────

  const resolveFromMap = (id: number | null, map: Map<number, number>): number | null =>
    id === null ? null : (map.get(id) ?? null);

  const buildAccountTypeMap = (userId: number, types: FullExport['account_types']) => {
    const map = new Map<number, number>();
    for (const at of types) {
      const existing = findAccountTypeByName.get(userId, at.name);
      const id = existing
        ? existing.id
        : Number(
            insertAccountType.run(userId, at.name, at.is_investment, at.is_loan).lastInsertRowid,
          );
      map.set(at.id, id);
    }
    return map;
  };

  const buildBankMap = (banks: FullExport['banks']) => {
    const map = new Map<number, number>();
    for (const b of banks) {
      const existing = findBankByName.get(b.name);
      const id = existing
        ? existing.id
        : Number(insertBank.run(b.name, b.logo, b.domain).lastInsertRowid);
      map.set(b.id, id);
    }
    return map;
  };

  const buildAccountMap = (
    userId: number,
    accounts: FullExport['accounts'],
    bankMap: Map<number, number>,
    accountTypeMap: Map<number, number>,
  ) => {
    const map = new Map<number, number>();
    let created = 0;
    for (const a of accounts) {
      const existing = findAccountByName.get(userId, a.name);
      if (existing) {
        map.set(a.id, existing.id);
      } else {
        const res = insertAccount.run(
          userId,
          a.name,
          resolveFromMap(a.bank_id, bankMap) ?? a.bank_id,
          accountTypeMap.get(a.account_type_id) ?? a.account_type_id,
          a.initial_balance,
          a.opening_date,
          a.closed_at,
        );
        map.set(a.id, Number(res.lastInsertRowid));
        created++;
      }
    }
    return { map, created };
  };

  const buildSubcategoryMap = (userId: number, categories: FullExport['categories']) => {
    const map = new Map<number, number>();
    for (const c of categories) {
      const existingCat = findCategoryByName.get(userId, c.name);
      const catId = existingCat
        ? existingCat.id
        : Number(insertCategory.run(userId, c.name, c.icon).lastInsertRowid);
      for (const sc of c.subcategories) {
        const existingSc = findSubcategoryByName.get(catId, sc.name);
        const scId = existingSc
          ? existingSc.id
          : Number(insertSubcategory.run(userId, catId, sc.name).lastInsertRowid);
        map.set(sc.id, scId);
      }
    }
    return map;
  };

  const buildPaymentMethodMap = (userId: number, methods: FullExport['payment_methods']) => {
    const map = new Map<number, number>();
    for (const pm of methods) {
      const existing = findPaymentMethodByName.get(userId, pm.name);
      const id = existing
        ? existing.id
        : Number(insertPaymentMethod.run(userId, pm.name, pm.icon).lastInsertRowid);
      map.set(pm.id, id);
    }
    return map;
  };

  const insertTransactions = (
    userId: number,
    transactions: FullExport['transactions'],
    accountMap: Map<number, number>,
    subcategoryMap: Map<number, number>,
    paymentMethodMap: Map<number, number>,
  ) => {
    const txMap = new Map<number, number>();
    let txCount = 0;
    let transferCount = 0;
    for (const tx of transactions) {
      const newAccountId = accountMap.get(tx.account_id);
      if (newAccountId === undefined) continue;
      const res = insertFullTxStmt.run(
        userId,
        newAccountId,
        tx.type,
        tx.amount,
        tx.description,
        resolveFromMap(tx.subcategory_id, subcategoryMap),
        resolveFromMap(tx.payment_method_id, paymentMethodMap),
        tx.date,
        tx.validated,
        tx.notes,
        tx.reimbursement_status,
      );
      txMap.set(tx.id, Number(res.lastInsertRowid));
      if (tx.transfer_peer_id === null) txCount++;
      else if (tx.type === 'expense') transferCount++;
    }
    return { txCount, transferCount, txMap };
  };

  const linkTransferPeers = (
    transactions: FullExport['transactions'],
    txMap: Map<number, number>,
  ) => {
    for (const tx of transactions) {
      if (tx.transfer_peer_id === null) continue;
      const newId = txMap.get(tx.id);
      const newPeerId = txMap.get(tx.transfer_peer_id);
      if (newId !== undefined && newPeerId !== undefined) setFullPeerStmt.run(newPeerId, newId);
    }
  };

  const insertSplits = (
    userId: number,
    transactions: FullExport['transactions'],
    txMap: Map<number, number>,
    subcategoryMap: Map<number, number>,
  ) => {
    for (const tx of transactions) {
      const newTxId = txMap.get(tx.id);
      if (newTxId === undefined || tx.splits.length === 0) continue;
      for (const split of tx.splits) {
        const newScId = subcategoryMap.get(split.subcategory_id);
        if (newScId !== undefined) insertSplitStmt.run(userId, newTxId, newScId, split.amount);
      }
    }
  };

  const importScheduled = (
    userId: number,
    scheduled: FullExport['scheduled_transactions'],
    accountMap: Map<number, number>,
    subcategoryMap: Map<number, number>,
    paymentMethodMap: Map<number, number>,
  ) => {
    let count = 0;
    for (const sched of scheduled) {
      const newAccountId = accountMap.get(sched.account_id);
      if (newAccountId === undefined) continue;
      insertScheduledStmt.run(
        userId,
        newAccountId,
        sched.type,
        sched.amount,
        sched.description,
        resolveFromMap(sched.subcategory_id, subcategoryMap),
        resolveFromMap(sched.payment_method_id, paymentMethodMap),
        sched.notes,
        sched.recurrence_unit,
        sched.recurrence_interval,
        sched.recurrence_day,
        sched.recurrence_month,
        resolveFromMap(sched.to_account_id, accountMap),
        sched.weekend_handling,
        sched.start_date,
        sched.end_date,
        sched.active,
      );
      count++;
    }
    return count;
  };

  const importStockPositions = (
    userId: number,
    positions: FullExport['stock_positions'],
    accountMap: Map<number, number>,
  ) => {
    for (const pos of positions) {
      const newAccountId = accountMap.get(pos.account_id);
      if (newAccountId !== undefined)
        upsertStockPosition.run(userId, newAccountId, pos.ticker, pos.quantity, pos.avg_price);
    }
  };

  const importStockOperations = (
    userId: number,
    operations: FullExport['stock_operations'],
    accountMap: Map<number, number>,
    txMap: Map<number, number>,
  ) => {
    let count = 0;
    for (const op of operations) {
      const newAccountId = accountMap.get(op.account_id);
      const newTxId = txMap.get(op.transaction_id);
      if (newAccountId === undefined || newTxId === undefined) continue;
      insertStockOp.run(
        userId,
        newAccountId,
        newTxId,
        resolveFromMap(op.fees_transaction_id, txMap),
        op.ticker,
        op.type,
        op.quantity,
        op.price_per_share,
        op.fees,
        op.date,
      );
      count++;
    }
    return count;
  };

  const importLoans = (
    userId: number,
    loans: FullExport['loans'],
    accountMap: Map<number, number>,
    txMap: Map<number, number>,
  ) => {
    let count = 0;
    for (const loan of loans) {
      const newAccountId = accountMap.get(loan.account_id);
      if (newAccountId === undefined) continue;
      const loanRes = insertLoan.run(
        newAccountId,
        userId,
        loan.principal_amount,
        loan.interest_rate,
        loan.duration_months,
        loan.start_date,
        loan.monthly_payment,
        accountMap.get(loan.source_account_id) ?? loan.source_account_id,
        accountMap.get(loan.deposit_account_id) ?? loan.deposit_account_id,
        resolveFromMap(loan.deposit_transaction_id, txMap),
      );
      if (loanRes.changes === 0) continue;
      const newLoanId = Number(loanRes.lastInsertRowid);
      count++;
      for (const inst of loan.installments) {
        insertInstallment.run(
          userId,
          newLoanId,
          inst.installment_number,
          inst.due_date,
          inst.total_amount,
          inst.principal_amount,
          inst.interest_amount,
          resolveFromMap(inst.transaction_id, txMap),
        );
      }
    }
    return count;
  };

  const insertAccountStmt = db.prepare(
    `INSERT INTO accounts (user_id, name, bank_id, account_type_id, initial_balance, opening_date)
     VALUES (:user_id, :name, :bank_id, :account_type_id, :initial_balance, :opening_date)`,
  );
  const insertCategoryStmt = db.prepare(
    `INSERT INTO categories (user_id, name, icon) VALUES (:userId, :name, :icon)`,
  );
  const insertSubcategoryStmt = db.prepare(
    `INSERT INTO subcategories (user_id, category_id, name) VALUES (:userId, :categoryId, :name)`,
  );
  const insertTxStmt = db.prepare(`
    INSERT INTO transactions
    (user_id, account_id, type, amount, description, subcategory_id, date,
     payment_method_id, notes, validated, reimbursement_status, scheduled_id)
    VALUES
    (:userId, :accountId, :type, :amount, :description, :subcategoryId, :date,
     :paymentMethodId, :notes, :validated, NULL, NULL)
  `);
  const setPeerStmt = db.prepare(
    `UPDATE transactions SET transfer_peer_id = :peerId WHERE id = :id`,
  );

  return {
    execute(userId: number, body: ImportExecuteBody): ImportResult {
      return db.transaction(() => {
        const { subcategoryId: transferSubcatId, paymentMethodId } = getTransferIds(db, userId);

        // 1. Create new accounts, build qif_name → account_id map
        const accountMap = new Map<string, number>();
        for (const na of body.newAccounts) {
          const res = insertAccountStmt.run({
            user_id: userId,
            name: na.name,
            bank_id: na.bank_id,
            account_type_id: na.account_type_id,
            initial_balance: toCents(na.initial_balance),
            opening_date: na.opening_date,
          });
          accountMap.set(na.qif_name, Number(res.lastInsertRowid));
        }

        const resolveAccount = (id: number | null, qifName: string | null): number => {
          if (id !== null) return id;
          if (qifName !== null) return accountMap.get(qifName) ?? 0;
          return 0;
        };

        // 2. Create new subcategories, build qif_key → subcategory_id map
        const subcategoryMap = new Map<string, number>();
        for (const ns of body.newSubcategories) {
          let categoryId = ns.category_id;
          if (!categoryId) {
            const res = insertCategoryStmt.run({
              userId,
              name: ns.new_category_name,
              icon: ns.new_category_icon ?? '📁',
            });
            categoryId = Number(res.lastInsertRowid);
          }
          const res = insertSubcategoryStmt.run({ userId, categoryId, name: ns.subcategory_name });
          subcategoryMap.set(ns.qif_key, Number(res.lastInsertRowid));
        }

        // 3. Insert regular transactions
        let txCount = 0;
        for (const tx of body.transactions) {
          const accountId = resolveAccount(tx.account_id, tx.new_account_qif_name);
          const subcategoryId =
            tx.new_subcategory_key === null
              ? tx.subcategory_id
              : (subcategoryMap.get(tx.new_subcategory_key) ?? null);
          insertTxStmt.run({
            userId,
            accountId,
            type: tx.type,
            amount: toCents(tx.amount),
            description: tx.description,
            subcategoryId,
            date: tx.date,
            paymentMethodId: tx.payment_method_id ?? null,
            notes: tx.notes,
            validated: tx.validated ? 1 : 0,
          });
          txCount++;
        }

        // 4. Insert transfers (two linked transactions each)
        let transferCount = 0;
        for (const tf of body.transfers) {
          const fromId = resolveAccount(tf.from_account_id, tf.from_account_qif_name);
          const toId = resolveAccount(tf.to_account_id, tf.to_account_qif_name);
          const tfCents = toCents(tf.amount);
          const expenseId = Number(
            insertTxStmt.run({
              userId,
              accountId: fromId,
              type: 'expense',
              amount: tfCents,
              description: tf.description,
              subcategoryId: transferSubcatId ?? null,
              date: tf.date,
              paymentMethodId: paymentMethodId ?? null,
              notes: tf.notes,
              validated: tf.validated ? 1 : 0,
            }).lastInsertRowid,
          );
          const incomeId = Number(
            insertTxStmt.run({
              userId,
              accountId: toId,
              type: 'income',
              amount: tfCents,
              description: tf.description,
              subcategoryId: transferSubcatId ?? null,
              date: tf.date,
              paymentMethodId: paymentMethodId ?? null,
              notes: tf.notes,
              validated: tf.validated ? 1 : 0,
            }).lastInsertRowid,
          );
          setPeerStmt.run({ peerId: incomeId, id: expenseId });
          setPeerStmt.run({ peerId: expenseId, id: incomeId });
          transferCount++;
        }

        return { transactions: txCount, transfers: transferCount };
      })();
    },

    executeJsonFull(userId: number, data: FullExport): JsonFullImportResult {
      return db.transaction(() => {
        const accountTypeMap = buildAccountTypeMap(userId, data.account_types);
        const bankMap = buildBankMap(data.banks);
        const { map: accountMap, created: accounts } = buildAccountMap(
          userId,
          data.accounts,
          bankMap,
          accountTypeMap,
        );
        const subcategoryMap = buildSubcategoryMap(userId, data.categories);
        const paymentMethodMap = buildPaymentMethodMap(userId, data.payment_methods);
        const {
          txCount: transactions,
          transferCount: transfers,
          txMap,
        } = insertTransactions(
          userId,
          data.transactions,
          accountMap,
          subcategoryMap,
          paymentMethodMap,
        );
        linkTransferPeers(data.transactions, txMap);
        insertSplits(userId, data.transactions, txMap, subcategoryMap);
        const scheduled = importScheduled(
          userId,
          data.scheduled_transactions,
          accountMap,
          subcategoryMap,
          paymentMethodMap,
        );
        importStockPositions(userId, data.stock_positions, accountMap);
        const stockOperations = importStockOperations(
          userId,
          data.stock_operations,
          accountMap,
          txMap,
        );
        const loans = importLoans(userId, data.loans, accountMap, txMap);
        return { accounts, transactions, transfers, scheduled, stockOperations, loans };
      })();
    },
  };
}
