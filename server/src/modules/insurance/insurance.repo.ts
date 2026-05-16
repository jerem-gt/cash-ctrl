import type { Database } from 'better-sqlite3';

import { checkAccountOwnership, getAccountEnvelopeType } from '../../lib/accountHelpers';
import {
  getBankFeesSubcategoryId,
  getPrelevementPaymentMethodId,
  getSocialFeesSubcategoryId,
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
  UpdateOperationInput,
  VersementInput,
} from './insurance.types';

function getAccountName(db: Database, accountId: number): string {
  const row = db
    .prepare<[number], { name: string }>('SELECT name FROM accounts WHERE id = ?')
    .get(accountId);
  return row?.name ?? '';
}

function mapOperation(row: InsuranceOperation): InsuranceOperation {
  return {
    ...row,
    amount: toEuros(row.amount),
    fees: toEuros(row.fees),
    social_fees: toEuros(row.social_fees),
    from_scheduled: !!row.from_scheduled,
  };
}

function insertInsuranceFeesTransaction(
  db: Database,
  userId: number,
  accountId: number | null,
  feesCents: number,
  feesDescription: string,
  date: string,
  subcategoryIdOverride?: number | null,
): number | null {
  if (feesCents <= 0 || accountId == null) return null;
  const subcategoryId = subcategoryIdOverride ?? getBankFeesSubcategoryId(db, userId) ?? null;
  const paymentMethodId = getPrelevementPaymentMethodId(db, userId) ?? null;
  const result = db
    .prepare(
      `INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, validated)
       VALUES (?, ?, 'expense', ?, ?, ?, ?, ?, 1)`,
    )
    .run(userId, accountId, feesCents, feesDescription, subcategoryId, date, paymentMethodId);
  return Number(result.lastInsertRowid);
}

const OPERATION_SELECT = `
  SELECT io.id, io.account_id, io.support_id, ins.name AS support_name, ins.type AS support_type,
         io.transaction_id, io.fees_transaction_id, io.social_fees_transaction_id, io.type,
         io.amount, io.fees, io.social_fees, io.date, io.arbitrage_peer_id, io.created_at,
         (t.scheduled_id IS NOT NULL) AS from_scheduled
  FROM insurance_operations io
  JOIN insurance_supports ins ON io.support_id = ins.id
  LEFT JOIN transactions t ON io.transaction_id = t.id`;

type InsuranceTxAndOpOpts = {
  accountId: number;
  supportId: number;
  txAccountId: number | null;
  txType: 'expense' | 'income';
  opType: 'versement' | 'rachat';
  amountCents: number;
  feesCents: number;
  description: string;
  date: string;
  socialFeesCents?: number;
  socialFeesTxAccountId?: number | null;
};

function insertInsuranceTxAndOp(
  db: Database,
  userId: number,
  opts: InsuranceTxAndOpOpts,
): { operation: InsuranceOperation; transaction_id: number | null } {
  const {
    accountId,
    supportId,
    txAccountId,
    txType,
    opType,
    amountCents,
    feesCents,
    description,
    date,
    socialFeesCents = 0,
    socialFeesTxAccountId = null,
  } = opts;

  let transactionId: number | null = null;
  if (txAccountId != null) {
    const txResult = db
      .prepare(
        `INSERT INTO transactions (user_id, account_id, type, amount, description, date, validated)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
      )
      .run(userId, txAccountId, txType, amountCents, description, date);
    transactionId = Number(txResult.lastInsertRowid);
  }

  // For versements, fees are embedded in the versement amount — no separate source debit.
  const feesAccountId = opType === 'rachat' ? txAccountId : null;
  const feesTransactionId = insertInsuranceFeesTransaction(
    db,
    userId,
    feesAccountId,
    feesCents,
    `Frais — ${description}`,
    date,
  );

  const socialSubcatId =
    socialFeesCents > 0 ? (getSocialFeesSubcategoryId(db, userId) ?? null) : null;
  const socialFeesTransactionId = insertInsuranceFeesTransaction(
    db,
    userId,
    socialFeesTxAccountId,
    socialFeesCents,
    `Prélèvements sociaux — ${description}`,
    date,
    socialSubcatId,
  );

  const opResult = db
    .prepare(
      `INSERT INTO insurance_operations
         (user_id, account_id, support_id, transaction_id, fees_transaction_id,
          social_fees_transaction_id, type, amount, fees, social_fees, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      accountId,
      supportId,
      transactionId,
      feesTransactionId,
      socialFeesTransactionId,
      opType,
      amountCents,
      feesCents,
      socialFeesCents,
      date,
    );

  const op = db
    .prepare<[number], InsuranceOperation>(`${OPERATION_SELECT} WHERE io.id = ?`)
    .get(Number(opResult.lastInsertRowid))!;

  return { operation: mapOperation(op), transaction_id: transactionId };
}

export function createInsuranceRepo(db: Database) {
  return {
    accountBelongsToUser: (accountId: number, userId: number): boolean =>
      checkAccountOwnership(db, accountId, userId),

    isInsuranceAccount(accountId: number): boolean {
      const type = getAccountEnvelopeType(db, accountId);
      return type === 'life_insurance' || type === 'per';
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

    hasOperations(supportId: number): boolean {
      const row = db
        .prepare<
          [number],
          { n: number }
        >('SELECT COUNT(*) AS n FROM insurance_operations WHERE support_id = ?')
        .get(supportId);
      return (row?.n ?? 0) > 0;
    },

    deleteSupport(supportId: number): void {
      db.prepare('DELETE FROM insurance_supports WHERE id = ?').run(supportId);
    },

    deleteOperation(operationId: number, userId: number): void {
      const op = db
        .prepare<
          [number, number],
          { transaction_id: number | null; arbitrage_peer_id: number | null }
        >('SELECT transaction_id, arbitrage_peer_id FROM insurance_operations WHERE id = ? AND user_id = ?')
        .get(operationId, userId);
      if (!op) throw new Error('Opération introuvable');
      const peerId = op.arbitrage_peer_id;
      db.transaction(() => {
        db.prepare('DELETE FROM insurance_operations WHERE id = ?').run(operationId);
        // insurance_op_fees_cleanup trigger handles fees_transaction_id
        if (op.transaction_id != null) {
          db.prepare('DELETE FROM transactions WHERE id = ?').run(op.transaction_id);
        }
        if (peerId != null) {
          db.prepare('DELETE FROM insurance_operations WHERE id = ?').run(peerId);
        }
      })();
    },

    getBalanceCents(accountId: number, supportId: number): number {
      const row = db
        .prepare<[number, number], { balance: number }>(
          `SELECT COALESCE(
             SUM((CASE WHEN type IN ('versement', 'arbitrage_in', 'interets', 'revalorisation') THEN amount ELSE -amount END) - fees - social_fees),
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

    updateOperation(
      operationId: number,
      userId: number,
      input: UpdateOperationInput,
    ): InsuranceOperation {
      return db.transaction(() => {
        const op = db
          .prepare<
            [number, number],
            {
              id: number;
              type: string;
              transaction_id: number | null;
              fees_transaction_id: number | null;
              social_fees_transaction_id: number | null;
              account_id: number;
              support_name: string;
            }
          >(
            `SELECT io.id, io.type, io.transaction_id, io.fees_transaction_id,
                    io.social_fees_transaction_id, io.account_id, ins.name AS support_name
             FROM insurance_operations io
             JOIN insurance_supports ins ON io.support_id = ins.id
             WHERE io.id = ? AND io.user_id = ?`,
          )
          .get(operationId, userId);

        if (!op) throw new Error('Opération introuvable');
        if (op.type === 'arbitrage_in' || op.type === 'arbitrage_out') {
          throw new Error('Les arbitrages ne peuvent pas être modifiés');
        }
        if (op.type !== 'revalorisation' && input.amount <= 0) {
          throw new Error('Le montant doit être positif');
        }

        const amountCents = toCents(input.amount);
        const feesCents = op.type === 'versement' || op.type === 'rachat' ? toCents(input.fees) : 0;
        const socialFeesCents = op.type === 'rachat' ? toCents(input.social_fees) : 0;

        db.prepare(
          'UPDATE insurance_operations SET amount = ?, fees = ?, social_fees = ?, date = ? WHERE id = ?',
        ).run(amountCents, feesCents, socialFeesCents, input.date, operationId);

        if (op.transaction_id != null) {
          db.prepare('UPDATE transactions SET amount = ?, date = ? WHERE id = ?').run(
            amountCents,
            input.date,
            op.transaction_id,
          );
        }

        if (op.fees_transaction_id != null) {
          if (feesCents > 0) {
            db.prepare('UPDATE transactions SET amount = ?, date = ? WHERE id = ?').run(
              feesCents,
              input.date,
              op.fees_transaction_id,
            );
          } else {
            // FK ON DELETE SET NULL will clear fees_transaction_id automatically
            db.prepare('DELETE FROM transactions WHERE id = ?').run(op.fees_transaction_id);
          }
        } else if (feesCents > 0 && op.transaction_id != null) {
          const mainTx = db
            .prepare<
              [number],
              { account_id: number; description: string }
            >('SELECT account_id, description FROM transactions WHERE id = ?')
            .get(op.transaction_id);
          if (mainTx) {
            const feesId = insertInsuranceFeesTransaction(
              db,
              userId,
              mainTx.account_id,
              feesCents,
              `Frais — ${mainTx.description}`,
              input.date,
            );
            if (feesId != null) {
              db.prepare(
                'UPDATE insurance_operations SET fees_transaction_id = ? WHERE id = ?',
              ).run(feesId, operationId);
            }
          }
        }

        if (op.social_fees_transaction_id != null) {
          if (socialFeesCents > 0) {
            db.prepare('UPDATE transactions SET amount = ?, date = ? WHERE id = ?').run(
              socialFeesCents,
              input.date,
              op.social_fees_transaction_id,
            );
          } else {
            // FK ON DELETE SET NULL will clear social_fees_transaction_id automatically
            db.prepare('DELETE FROM transactions WHERE id = ?').run(op.social_fees_transaction_id);
          }
        } else if (socialFeesCents > 0) {
          const socialSubcatId = getSocialFeesSubcategoryId(db, userId) ?? null;
          const socialFeesId = insertInsuranceFeesTransaction(
            db,
            userId,
            op.account_id,
            socialFeesCents,
            `Prélèvements sociaux — ${op.support_name}`,
            input.date,
            socialSubcatId,
          );
          if (socialFeesId != null) {
            db.prepare(
              'UPDATE insurance_operations SET social_fees_transaction_id = ? WHERE id = ?',
            ).run(socialFeesId, operationId);
          }
        }

        const updated = db
          .prepare<[number], InsuranceOperation>(`${OPERATION_SELECT} WHERE io.id = ?`)
          .get(operationId)!;
        return mapOperation(updated);
      })();
    },

    // ─── Versement ───────────────────────────────────────────────────────────

    versement(
      userId: number,
      input: VersementInput,
    ): { operation: InsuranceOperation; transaction_id: number | null } {
      const amountCents = toCents(input.amount);
      const feesCents = toCents(input.fees);
      const support = this.getSupportById(input.support_id)!;
      const accountName = getAccountName(db, input.account_id);
      const accountPrefix = accountName ? `${accountName} · ` : '';
      const description =
        support.type === 'uc'
          ? `Versement UC — ${accountPrefix}${support.name}`
          : `Versement fonds euro — ${accountPrefix}${support.name}`;

      const txAccountId = input.source_account_id ?? null;

      return db.transaction(() =>
        insertInsuranceTxAndOp(db, userId, {
          accountId: input.account_id,
          supportId: input.support_id,
          txAccountId,
          txType: 'expense',
          opType: 'versement',
          amountCents,
          feesCents,
          description,
          date: input.date,
        }),
      )();
    },

    // ─── Rachat ──────────────────────────────────────────────────────────────

    rachat(
      userId: number,
      input: RachatInput,
    ): { operation: InsuranceOperation; transaction_id: number | null } {
      const amountCents = toCents(input.amount);
      const feesCents = toCents(input.fees);
      const socialFeesCents = toCents(input.social_fees);

      if (amountCents - feesCents - socialFeesCents <= 0) {
        throw new Error('Le montant net après frais et prélèvements sociaux doit être positif');
      }

      const balanceCents = this.getBalanceCents(input.account_id, input.support_id);
      if (amountCents > balanceCents) {
        throw new Error(`Solde insuffisant : ${toEuros(balanceCents).toFixed(2)} € disponible(s)`);
      }

      const support = this.getSupportById(input.support_id)!;
      const accountName = getAccountName(db, input.account_id);
      const accountPrefix = accountName ? `${accountName} · ` : '';
      const description =
        support.type === 'uc'
          ? `Rachat UC — ${accountPrefix}${support.name}`
          : `Rachat fonds euro — ${accountPrefix}${support.name}`;

      const txAccountId = input.dest_account_id ?? null;

      return db.transaction(() =>
        insertInsuranceTxAndOp(db, userId, {
          accountId: input.account_id,
          supportId: input.support_id,
          txAccountId,
          txType: 'income',
          opType: 'rachat',
          amountCents,
          feesCents,
          description,
          date: input.date,
          socialFeesCents,
          socialFeesTxAccountId: input.account_id,
        }),
      )();
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
        const feesTransactionId = insertInsuranceFeesTransaction(
          db,
          userId,
          input.account_id,
          feesCents,
          `Frais arbitrage — ${fromSupport.name} → ${toSupport.name}`,
          input.date,
        );

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
