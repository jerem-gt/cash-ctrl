import type { Database } from 'better-sqlite3';

import { getTransferIds } from '../../lib/administrationDataConstants.js';
import type { ImportExecuteBody, ImportResult } from './import.types.js';

export function createImportRepo(db: Database) {
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
            initial_balance: na.initial_balance,
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
            amount: tx.amount,
            description: tx.description,
            subcategoryId,
            date: tx.date,
            paymentMethodId: paymentMethodId ?? null,
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
          const expenseId = Number(
            insertTxStmt.run({
              userId,
              accountId: fromId,
              type: 'expense',
              amount: tf.amount,
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
              amount: tf.amount,
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
  };
}
