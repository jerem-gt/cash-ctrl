import type { Database } from 'better-sqlite3';

import {
  getBankFeesSubcategoryId,
  getPrelevementPaymentMethodId,
} from '../../lib/administrationDataConstants';
import { toCents, toEuros } from '../../lib/money';
import { StockPrice } from '../stocks/stocks.types';
import {
  ArbitrageInput,
  CreateSupportInput,
  InsuranceOperation,
  InsuranceSupport,
  InsuranceSupportView,
  InteretsInput,
  RachatInput,
  VersementInput,
} from './insurance.types';

function mapOperation(row: InsuranceOperation): InsuranceOperation {
  return {
    ...row,
    amount: toEuros(row.amount),
    fees: toEuros(row.fees),
    price_per_unit: row.price_per_unit != null ? toEuros(row.price_per_unit) : null,
  };
}

const OPERATION_SELECT = `
  SELECT io.id, io.account_id, io.support_id, ins.name AS support_name, ins.type AS support_type,
         io.transaction_id, io.fees_transaction_id, io.type, io.quantity, io.price_per_unit,
         io.amount, io.fees, io.date, io.arbitrage_peer_id, io.created_at
  FROM insurance_operations io
  JOIN insurance_supports ins ON io.support_id = ins.id`;

export function createInsuranceRepo(db: Database) {
  const getStockPriceStmt = db.prepare<{ ticker: string }, StockPrice>(
    `SELECT ticker, price, currency, name, fetched_at FROM stock_prices WHERE ticker = :ticker`,
  );
  const upsertPriceStmt = db.prepare(
    `INSERT OR REPLACE INTO stock_prices (ticker, price, currency, name, fetched_at)
     VALUES (:ticker, :price, :currency, :name, datetime('now'))`,
  );

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

    getEuroBalanceCents(accountId: number, supportId: number): number {
      const row = db
        .prepare<[number, number], { balance: number }>(
          `SELECT COALESCE(
             SUM(CASE WHEN type IN ('versement', 'arbitrage_in', 'interets') THEN amount ELSE -amount END),
             0
           ) AS balance
           FROM insurance_operations
           WHERE account_id = ? AND support_id = ?`,
        )
        .get(accountId, supportId);
      return row?.balance ?? 0;
    },

    getUcPositionQty(accountId: number, supportId: number): number {
      const row = db
        .prepare<
          [number, number],
          { quantity: number }
        >('SELECT quantity FROM insurance_positions WHERE account_id = ? AND support_id = ?')
        .get(accountId, supportId);
      return row?.quantity ?? 0;
    },

    // ─── Positions ───────────────────────────────────────────────────────────

    getPositions(accountId: number): InsuranceSupportView[] {
      const supports = this.getSupports(accountId);
      return supports.map((s) => {
        if (s.type === 'uc') {
          const pos = db
            .prepare<
              [number],
              { quantity: number; avg_price: number }
            >('SELECT quantity, avg_price FROM insurance_positions WHERE support_id = ?')
            .get(s.id);
          const priceRow = s.ticker ? getStockPriceStmt.get({ ticker: s.ticker }) : null;
          const quantity = pos?.quantity ?? 0;
          const avg_price = pos ? toEuros(pos.avg_price) : 0;
          const current_price = priceRow?.price ?? null;
          return {
            id: s.id,
            account_id: s.account_id,
            name: s.name,
            type: 'uc' as const,
            ticker: s.ticker,
            quantity,
            avg_price,
            current_price,
            current_price_currency: priceRow?.currency ?? 'EUR',
            balance: null,
            value: current_price != null ? current_price * quantity : avg_price * quantity,
          };
        } else {
          const balanceCents = this.getEuroBalanceCents(accountId, s.id);
          const balance = toEuros(balanceCents);
          return {
            id: s.id,
            account_id: s.account_id,
            name: s.name,
            type: 'euro' as const,
            ticker: null,
            quantity: null,
            avg_price: null,
            current_price: null,
            current_price_currency: 'EUR',
            balance,
            value: balance,
          };
        }
      });
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
    ): { operation: InsuranceOperation; transaction_id: number } {
      const amountCents = toCents(input.amount);
      const feesCents = toCents(input.fees);
      const support = this.getSupportById(input.support_id)!;
      const priceCents =
        input.price_per_unit != null ? Math.round(input.price_per_unit * 100) : null;
      const description =
        support.type === 'uc'
          ? `Versement UC — ${support.name}`
          : `Versement fonds euro — ${support.name}`;

      return db.transaction(() => {
        const txResult = db
          .prepare(
            `INSERT INTO transactions (user_id, account_id, type, amount, description, date, validated)
             VALUES (?, ?, 'expense', ?, ?, ?, 1)`,
          )
          .run(userId, input.account_id, amountCents, description, input.date);
        const transactionId = Number(txResult.lastInsertRowid);

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
                type, quantity, price_per_unit, amount, fees, date)
             VALUES (?, ?, ?, ?, ?, 'versement', ?, ?, ?, ?, ?)`,
          )
          .run(
            userId,
            input.account_id,
            input.support_id,
            transactionId,
            feesTransactionId,
            input.quantity ?? null,
            priceCents,
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
    ): { operation: InsuranceOperation; transaction_id: number } {
      const amountCents = toCents(input.amount);
      const feesCents = toCents(input.fees);

      if (amountCents - feesCents <= 0) {
        throw new Error('Le montant net après frais doit être positif');
      }

      const support = this.getSupportById(input.support_id)!;
      const priceCents =
        input.price_per_unit != null ? Math.round(input.price_per_unit * 100) : null;

      if (support.type === 'uc') {
        const availableQty = this.getUcPositionQty(input.account_id, input.support_id);
        if (input.quantity == null || input.quantity > availableQty) {
          throw new Error(
            `Quantité insuffisante : ${availableQty.toFixed(6)} part(s) disponible(s)`,
          );
        }
      } else {
        const balanceCents = this.getEuroBalanceCents(input.account_id, input.support_id);
        if (amountCents > balanceCents) {
          throw new Error(
            `Solde insuffisant : ${toEuros(balanceCents).toFixed(2)} € disponible(s)`,
          );
        }
      }

      const description =
        support.type === 'uc'
          ? `Rachat UC — ${support.name}`
          : `Rachat fonds euro — ${support.name}`;

      return db.transaction(() => {
        const txResult = db
          .prepare(
            `INSERT INTO transactions (user_id, account_id, type, amount, description, date, validated)
             VALUES (?, ?, 'income', ?, ?, ?, 1)`,
          )
          .run(userId, input.account_id, amountCents, description, input.date);
        const transactionId = Number(txResult.lastInsertRowid);

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
                type, quantity, price_per_unit, amount, fees, date)
             VALUES (?, ?, ?, ?, ?, 'rachat', ?, ?, ?, ?, ?)`,
          )
          .run(
            userId,
            input.account_id,
            input.support_id,
            transactionId,
            feesTransactionId,
            input.quantity ?? null,
            priceCents,
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
      const fromPriceCents =
        input.from_price_per_unit != null ? Math.round(input.from_price_per_unit * 100) : null;
      const toPriceCents =
        input.to_price_per_unit != null ? Math.round(input.to_price_per_unit * 100) : null;

      if (fromSupport.type === 'uc') {
        const availableQty = this.getUcPositionQty(input.account_id, input.from_support_id);
        if (input.from_quantity == null || input.from_quantity > availableQty) {
          throw new Error(
            `Quantité insuffisante sur ${fromSupport.name} : ${availableQty.toFixed(6)} part(s)`,
          );
        }
      } else {
        const balanceCents = this.getEuroBalanceCents(input.account_id, input.from_support_id);
        if (fromAmountCents > balanceCents) {
          throw new Error(
            `Solde insuffisant sur ${fromSupport.name} : ${toEuros(balanceCents).toFixed(2)} €`,
          );
        }
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
                type, quantity, price_per_unit, amount, fees, date)
             VALUES (?, ?, ?, NULL, ?, 'arbitrage_out', ?, ?, ?, ?, ?)`,
          )
          .run(
            userId,
            input.account_id,
            input.from_support_id,
            feesTransactionId,
            fromSupport.type === 'uc' ? (input.from_quantity ?? null) : null,
            fromPriceCents,
            fromAmountCents,
            feesCents,
            input.date,
          );
        const outId = Number(outResult.lastInsertRowid);

        const inResult = db
          .prepare(
            `INSERT INTO insurance_operations
               (user_id, account_id, support_id, transaction_id, fees_transaction_id,
                type, quantity, price_per_unit, amount, fees, date, arbitrage_peer_id)
             VALUES (?, ?, ?, NULL, NULL, 'arbitrage_in', ?, ?, ?, 0, ?, ?)`,
          )
          .run(
            userId,
            input.account_id,
            input.to_support_id,
            toSupport.type === 'uc' ? (input.to_quantity ?? null) : null,
            toPriceCents,
            fromAmountCents,
            input.date,
            outId,
          );
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
    ): { operation: InsuranceOperation; transaction_id: number } {
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
                type, quantity, price_per_unit, amount, fees, date)
             VALUES (?, ?, ?, ?, NULL, 'interets', NULL, NULL, ?, 0, ?)`,
          )
          .run(userId, input.account_id, input.support_id, transactionId, amountCents, input.date);

        const op = db
          .prepare<[number], InsuranceOperation>(`${OPERATION_SELECT} WHERE io.id = ?`)
          .get(Number(opResult.lastInsertRowid))!;

        return { operation: mapOperation(op), transaction_id: transactionId };
      })();
    },

    // ─── Prices ──────────────────────────────────────────────────────────────

    getUcTickers(accountId: number): string[] {
      return db
        .prepare<[number], string>(
          `SELECT DISTINCT ins.ticker
           FROM insurance_positions ip
           JOIN insurance_supports ins ON ip.support_id = ins.id
           WHERE ip.account_id = ? AND ip.quantity > 0 AND ins.ticker IS NOT NULL`,
        )
        .pluck()
        .all(accountId) as string[];
    },

    getStockPrice: (ticker: string) => getStockPriceStmt.get({ ticker }) ?? undefined,
    upsertPrice: (ticker: string, price: number, currency: string, name: string | null) =>
      upsertPriceStmt.run({ ticker, price, currency, name }),
  };
}
