import type { Database } from 'better-sqlite3';

import {
  getBankFeesSubcategoryId,
  getPrelevementPaymentMethodId,
} from '../../lib/administrationDataConstants';
import { toCents, toEuros } from '../../lib/money';
import {
  ArbitrageInput,
  CreateSupportInput,
  InsuranceOperation,
  InsuranceSupport,
  InsuranceSupportView,
  InteretsInput,
  RachatInput,
  RevaloriserInput,
  VersementInput,
} from './insurance.types';

function mapOperation(row: InsuranceOperation): InsuranceOperation {
  return {
    ...row,
    amount: toEuros(row.amount),
    fees: toEuros(row.fees),
  };
}

const OPERATION_SELECT = `
  SELECT io.id, io.account_id, io.support_id, ins.name AS support_name, ins.type AS support_type,
         io.transaction_id, io.fees_transaction_id, io.type,
         io.amount, io.fees, io.date, io.arbitrage_peer_id, io.created_at
  FROM insurance_operations io
  JOIN insurance_supports ins ON io.support_id = ins.id`;

export function createInsuranceRepo(db: Database) {
  return {
    accountBelongsToUser(accountId: number, userId: number): boolean {
      return !!db
        .prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?')
        .get(accountId, userId);
    },

    isInsuranceAccount(accountId: number): boolean {
      const row = db
        .prepare<[number], { envelope_type: string | null }>(
          `SELECT at.envelope_type
           FROM accounts a
           LEFT JOIN account_types at ON a.account_type_id = at.id
           WHERE a.id = ?`,
        )
        .get(accountId);
      return row?.envelope_type === 'life_insurance' || row?.envelope_type === 'per';
    },

    // ─── Supports ────────────────────────────────────────────────────────────

    createSupport(userId: number, input: CreateSupportInput): InsuranceSupport {
      const result = db
        .prepare(
          `INSERT INTO insurance_supports (user_id, account_id, name, type, ticker)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(userId, input.account_id, input.name, input.type, input.ticker ?? null);
      return db
        .prepare<[number], InsuranceSupport>('SELECT * FROM insurance_supports WHERE id = ?')
        .get(Number(result.lastInsertRowid))!;
    },

    getSupports(accountId: number): InsuranceSupport[] {
      return db
        .prepare<
          [number],
          InsuranceSupport
        >(`SELECT * FROM insurance_supports WHERE account_id = ? ORDER BY type, name`)
        .all(accountId);
    },

    getSupportById(supportId: number): InsuranceSupport | undefined {
      return (
        db
          .prepare<[number], InsuranceSupport>('SELECT * FROM insurance_supports WHERE id = ?')
          .get(supportId) ?? undefined
      );
    },

    deleteSupport(supportId: number): void {
      db.prepare('DELETE FROM insurance_supports WHERE id = ?').run(supportId);
    },

    getBalanceCents(accountId: number, supportId: number): number {
      const row = db
        .prepare<[number, number], { balance: number }>(
          `SELECT COALESCE(
             SUM(CASE WHEN type IN ('versement', 'arbitrage_in', 'interets', 'revalorisation') THEN amount ELSE -amount END),
             0
           ) AS balance
           FROM insurance_operations
           WHERE account_id = ? AND support_id = ?`,
        )
        .get(accountId, supportId);
      return row?.balance ?? 0;
    },

    // ─── Positions ───────────────────────────────────────────────────────────

    getPositions(accountId: number): InsuranceSupportView[] {
      const supports = this.getSupports(accountId);
      return supports.map((s) => ({
        id: s.id,
        account_id: s.account_id,
        name: s.name,
        type: s.type,
        ticker: s.ticker,
        value: toEuros(this.getBalanceCents(accountId, s.id)),
      }));
    },

    // ─── Operations ──────────────────────────────────────────────────────────

    getOperations(accountId: number): InsuranceOperation[] {
      return db
        .prepare<[number], InsuranceOperation>(
          `${OPERATION_SELECT}
           WHERE io.account_id = ?
           ORDER BY io.date DESC, io.created_at DESC`,
        )
        .all(accountId)
        .map(mapOperation);
    },

    // ─── Versement ───────────────────────────────────────────────────────────

    versement(
      userId: number,
      input: VersementInput,
    ): { operation: InsuranceOperation; transaction_id: number | null } {
      const amountCents = toCents(input.amount);
      const feesCents = toCents(input.fees);
      const support = this.getSupportById(input.support_id)!;
      const description =
        support.type === 'uc'
          ? `Versement UC — ${support.name}`
          : `Versement fonds euro — ${support.name}`;

      const txAccountId = input.source_account_id ?? null;

      return db.transaction(() => {
        let transactionId: number | null = null;
        if (txAccountId != null) {
          const txResult = db
            .prepare(
              `INSERT INTO transactions (user_id, account_id, type, amount, description, date, validated)
               VALUES (?, ?, 'expense', ?, ?, ?, 1)`,
            )
            .run(userId, txAccountId, amountCents, description, input.date);
          transactionId = Number(txResult.lastInsertRowid);
        }

        let feesTransactionId: number | null = null;
        if (feesCents > 0 && txAccountId != null) {
          const subcategoryId = getBankFeesSubcategoryId(db, userId) ?? null;
          const paymentMethodId = getPrelevementPaymentMethodId(db, userId) ?? null;
          const feesTx = db
            .prepare(
              `INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, validated)
               VALUES (?, ?, 'expense', ?, ?, ?, ?, ?, 1)`,
            )
            .run(
              userId,
              txAccountId,
              feesCents,
              `Frais — ${description}`,
              subcategoryId,
              input.date,
              paymentMethodId,
            );
          feesTransactionId = Number(feesTx.lastInsertRowid);
        }

        const opResult = db
          .prepare(
            `INSERT INTO insurance_operations
               (user_id, account_id, support_id, transaction_id, fees_transaction_id,
                type, amount, fees, date)
             VALUES (?, ?, ?, ?, ?, 'versement', ?, ?, ?)`,
          )
          .run(
            userId,
            input.account_id,
            input.support_id,
            transactionId,
            feesTransactionId,
            amountCents,
            feesCents,
            input.date,
          );

        const op = db
          .prepare<[number], InsuranceOperation>(`${OPERATION_SELECT} WHERE io.id = ?`)
          .get(Number(opResult.lastInsertRowid))!;

        return { operation: mapOperation(op), transaction_id: transactionId };
      })();
    },

    // ─── Rachat ──────────────────────────────────────────────────────────────

    rachat(
      userId: number,
      input: RachatInput,
    ): { operation: InsuranceOperation; transaction_id: number | null } {
      const amountCents = toCents(input.amount);
      const feesCents = toCents(input.fees);

      if (amountCents - feesCents <= 0) {
        throw new Error('Le montant net après frais doit être positif');
      }

      const balanceCents = this.getBalanceCents(input.account_id, input.support_id);
      if (amountCents > balanceCents) {
        throw new Error(`Solde insuffisant : ${toEuros(balanceCents).toFixed(2)} € disponible(s)`);
      }

      const support = this.getSupportById(input.support_id)!;
      const description =
        support.type === 'uc'
          ? `Rachat UC — ${support.name}`
          : `Rachat fonds euro — ${support.name}`;

      const txAccountId = input.dest_account_id ?? null;

      return db.transaction(() => {
        let transactionId: number | null = null;
        if (txAccountId != null) {
          const txResult = db
            .prepare(
              `INSERT INTO transactions (user_id, account_id, type, amount, description, date, validated)
               VALUES (?, ?, 'income', ?, ?, ?, 1)`,
            )
            .run(userId, txAccountId, amountCents, description, input.date);
          transactionId = Number(txResult.lastInsertRowid);
        }

        let feesTransactionId: number | null = null;
        if (feesCents > 0 && txAccountId != null) {
          const subcategoryId = getBankFeesSubcategoryId(db, userId) ?? null;
          const paymentMethodId = getPrelevementPaymentMethodId(db, userId) ?? null;
          const feesTx = db
            .prepare(
              `INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, validated)
               VALUES (?, ?, 'expense', ?, ?, ?, ?, ?, 1)`,
            )
            .run(
              userId,
              txAccountId,
              feesCents,
              `Frais — ${description}`,
              subcategoryId,
              input.date,
              paymentMethodId,
            );
          feesTransactionId = Number(feesTx.lastInsertRowid);
        }

        const opResult = db
          .prepare(
            `INSERT INTO insurance_operations
               (user_id, account_id, support_id, transaction_id, fees_transaction_id,
                type, amount, fees, date)
             VALUES (?, ?, ?, ?, ?, 'rachat', ?, ?, ?)`,
          )
          .run(
            userId,
            input.account_id,
            input.support_id,
            transactionId,
            feesTransactionId,
            amountCents,
            feesCents,
            input.date,
          );

        const op = db
          .prepare<[number], InsuranceOperation>(`${OPERATION_SELECT} WHERE io.id = ?`)
          .get(Number(opResult.lastInsertRowid))!;

        return { operation: mapOperation(op), transaction_id: transactionId };
      })();
    },

    // ─── Arbitrage ───────────────────────────────────────────────────────────

    arbitrage(
      userId: number,
      input: ArbitrageInput,
    ): { outOperation: InsuranceOperation; inOperation: InsuranceOperation } {
      const fromSupport = this.getSupportById(input.from_support_id)!;
      const toSupport = this.getSupportById(input.to_support_id)!;
      const fromAmountCents = toCents(input.from_amount);
      const feesCents = toCents(input.fees);

      const balanceCents = this.getBalanceCents(input.account_id, input.from_support_id);
      if (fromAmountCents > balanceCents) {
        throw new Error(
          `Solde insuffisant sur ${fromSupport.name} : ${toEuros(balanceCents).toFixed(2)} €`,
        );
      }

      return db.transaction(() => {
        let feesTransactionId: number | null = null;
        if (feesCents > 0) {
          const subcategoryId = getBankFeesSubcategoryId(db, userId) ?? null;
          const paymentMethodId = getPrelevementPaymentMethodId(db, userId) ?? null;
          const feesTx = db
            .prepare(
              `INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, validated)
               VALUES (?, ?, 'expense', ?, ?, ?, ?, ?, 1)`,
            )
            .run(
              userId,
              input.account_id,
              feesCents,
              `Frais arbitrage — ${fromSupport.name} → ${toSupport.name}`,
              subcategoryId,
              input.date,
              paymentMethodId,
            );
          feesTransactionId = Number(feesTx.lastInsertRowid);
        }

        const outResult = db
          .prepare(
            `INSERT INTO insurance_operations
               (user_id, account_id, support_id, transaction_id, fees_transaction_id,
                type, amount, fees, date)
             VALUES (?, ?, ?, NULL, ?, 'arbitrage_out', ?, ?, ?)`,
          )
          .run(
            userId,
            input.account_id,
            input.from_support_id,
            feesTransactionId,
            fromAmountCents,
            feesCents,
            input.date,
          );
        const outId = Number(outResult.lastInsertRowid);

        const inResult = db
          .prepare(
            `INSERT INTO insurance_operations
               (user_id, account_id, support_id, transaction_id, fees_transaction_id,
                type, amount, fees, date, arbitrage_peer_id)
             VALUES (?, ?, ?, NULL, NULL, 'arbitrage_in', ?, 0, ?, ?)`,
          )
          .run(userId, input.account_id, input.to_support_id, fromAmountCents, input.date, outId);
        const inId = Number(inResult.lastInsertRowid);

        db.prepare('UPDATE insurance_operations SET arbitrage_peer_id = ? WHERE id = ?').run(
          inId,
          outId,
        );

        const outOp = db
          .prepare<[number], InsuranceOperation>(`${OPERATION_SELECT} WHERE io.id = ?`)
          .get(outId)!;
        const inOp = db
          .prepare<[number], InsuranceOperation>(`${OPERATION_SELECT} WHERE io.id = ?`)
          .get(inId)!;

        return { outOperation: mapOperation(outOp), inOperation: mapOperation(inOp) };
      })();
    },

    // ─── Intérêts ────────────────────────────────────────────────────────────

    interets(
      userId: number,
      input: InteretsInput,
    ): { operation: InsuranceOperation; transaction_id: number | null } {
      const support = this.getSupportById(input.support_id)!;
      const amountCents = toCents(input.amount);
      const description = `Intérêts — ${support.name}`;

      return db.transaction(() => {
        const txResult = db
          .prepare(
            `INSERT INTO transactions (user_id, account_id, type, amount, description, date, validated)
             VALUES (?, ?, 'income', ?, ?, ?, 1)`,
          )
          .run(userId, input.account_id, amountCents, description, input.date);
        const transactionId = Number(txResult.lastInsertRowid);

        const opResult = db
          .prepare(
            `INSERT INTO insurance_operations
               (user_id, account_id, support_id, transaction_id, fees_transaction_id,
                type, amount, fees, date)
             VALUES (?, ?, ?, ?, NULL, 'interets', ?, 0, ?)`,
          )
          .run(userId, input.account_id, input.support_id, transactionId, amountCents, input.date);

        const op = db
          .prepare<[number], InsuranceOperation>(`${OPERATION_SELECT} WHERE io.id = ?`)
          .get(Number(opResult.lastInsertRowid))!;

        return { operation: mapOperation(op), transaction_id: transactionId };
      })();
    },

    // ─── Revalorisation ──────────────────────────────────────────────────────

    revaloriser(userId: number, input: RevaloriserInput): InsuranceOperation {
      const amountCents = Math.round(input.amount * 100);

      const opResult = db
        .prepare(
          `INSERT INTO insurance_operations
             (user_id, account_id, support_id, transaction_id, fees_transaction_id,
              type, amount, fees, date)
           VALUES (?, ?, ?, NULL, NULL, 'revalorisation', ?, 0, ?)`,
        )
        .run(userId, input.account_id, input.support_id, amountCents, input.date);

      const op = db
        .prepare<[number], InsuranceOperation>(`${OPERATION_SELECT} WHERE io.id = ?`)
        .get(Number(opResult.lastInsertRowid))!;

      return mapOperation(op);
    },
  };
}
