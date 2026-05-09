import type { Database } from 'better-sqlite3';

import {
  getBankFeesSubcategoryId,
  getPrelevementPaymentMethodId,
} from '../../lib/administrationDataConstants';
import { toCents, toEuros } from '../../lib/money';
import { BuyInput, SellInput, StockOperation, StockPosition, StockPrice } from './stocks.types';

function mapPosition(row: StockPosition): StockPosition {
  return { ...row };
}

function mapOperation(row: StockOperation): StockOperation {
  return { ...row, fees: toEuros(row.fees) };
}

function recalcPosition(db: Database, accountId: number, ticker: string, userId: number): void {
  const ops = db
    .prepare<
      [number, string],
      { type: string; quantity: number; price_per_share: number }
    >('SELECT type, quantity, price_per_share FROM stock_operations WHERE account_id = ? AND ticker = ? ORDER BY date, id')
    .all(accountId, ticker);

  let qty = 0;
  let avgPrice = 0;
  for (const op of ops) {
    if (op.type === 'buy') {
      const newQty = qty + op.quantity;
      avgPrice = newQty > 0 ? (qty * avgPrice + op.quantity * op.price_per_share) / newQty : 0;
      qty = newQty;
    } else {
      qty -= op.quantity;
    }
  }

  if (qty <= 0) {
    db.prepare('DELETE FROM stock_positions WHERE account_id = ? AND ticker = ?').run(
      accountId,
      ticker,
    );
  } else {
    db.prepare(
      `INSERT INTO stock_positions (user_id, account_id, ticker, quantity, avg_price, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(account_id, ticker) DO UPDATE SET
         quantity   = excluded.quantity,
         avg_price  = excluded.avg_price,
         updated_at = datetime('now')`,
    ).run(userId, accountId, ticker, qty, avgPrice);
  }
}

export function createStocksRepo(db: Database) {
  const getAllTickersStmt = db
    .prepare<[], string>(
      `
    SELECT DISTINCT ticker FROM stock_positions WHERE quantity > 0
  `,
    )
    .pluck();
  const getStockPriceStmt = db.prepare<{ ticker: string }, StockPrice>(`
    SELECT ticker, price, currency, name, fetched_at FROM stock_prices WHERE ticker = :ticker
  `);

  const upsertPriceStmt = db.prepare(`
    INSERT OR REPLACE INTO stock_prices (ticker, price, currency, name, fetched_at)
    VALUES (:ticker, :price, :currency, :name, datetime('now'))
  `);

  return {
    accountBelongsToUser(accountId: number, userId: number): boolean {
      return !!db
        .prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?')
        .get(accountId, userId);
    },

    isInvestmentAccount(accountId: number): boolean {
      const row = db
        .prepare<[number], { is_investment: number }>(
          `SELECT COALESCE(at.is_investment, 0) AS is_investment
           FROM accounts a
           LEFT JOIN account_types at ON a.account_type_id = at.id
           WHERE a.id = ?`,
        )
        .get(accountId);
      return !!row?.is_investment;
    },

    buy(userId: number, input: BuyInput): { operation: StockOperation; transaction_id: number } {
      const feesCents = toCents(input.fees);
      const mainCents = Math.round(input.quantity * input.price_per_share * 100);
      const description = input.description ?? `Achat ${input.quantity} × ${input.ticker}`;

      return db.transaction(() => {
        const txResult = db
          .prepare(
            'INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, notes) VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, NULL)',
          )
          .run(userId, input.account_id, 'expense', mainCents, description, input.date);
        const transactionId = Number(txResult.lastInsertRowid);

        let feesTransactionId: number | null = null;
        if (feesCents > 0) {
          const subcategoryId = getBankFeesSubcategoryId(db, userId) ?? null;
          const paymentMethodId = getPrelevementPaymentMethodId(db, userId) ?? null;
          const feesTxResult = db
            .prepare(
              'INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)',
            )
            .run(
              userId,
              input.account_id,
              'expense',
              feesCents,
              `Frais — ${description}`,
              subcategoryId,
              input.date,
              paymentMethodId,
            );
          feesTransactionId = Number(feesTxResult.lastInsertRowid);
        }

        const opResult = db
          .prepare(
            'INSERT INTO stock_operations (user_id, account_id, transaction_id, fees_transaction_id, ticker, type, quantity, price_per_share, fees, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .run(
            userId,
            input.account_id,
            transactionId,
            feesTransactionId,
            input.ticker,
            'buy',
            input.quantity,
            input.price_per_share,
            feesCents,
            input.date,
          );
        const operationId = Number(opResult.lastInsertRowid);

        recalcPosition(db, input.account_id, input.ticker, userId);

        const operation = db
          .prepare<[number], StockOperation>('SELECT * FROM stock_operations WHERE id = ?')
          .get(operationId)!;

        return { operation: mapOperation(operation), transaction_id: transactionId };
      })();
    },

    sell(userId: number, input: SellInput): { operation: StockOperation; transaction_id: number } {
      const position = db
        .prepare<
          [number, string],
          { quantity: number }
        >('SELECT quantity FROM stock_positions WHERE account_id = ? AND ticker = ?')
        .get(input.account_id, input.ticker);

      if (!position || position.quantity < input.quantity) {
        throw new Error(
          `Position insuffisante : ${position?.quantity ?? 0} action(s) disponible(s)`,
        );
      }

      const feesCents = toCents(input.fees);
      const mainCents = Math.round(input.quantity * input.price_per_share * 100);
      if (mainCents - feesCents <= 0) {
        throw new Error('Le montant net après frais doit être positif');
      }

      const description = input.description ?? `Vente ${input.quantity} × ${input.ticker}`;

      return db.transaction(() => {
        const txResult = db
          .prepare(
            'INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, notes) VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, NULL)',
          )
          .run(userId, input.account_id, 'income', mainCents, description, input.date);
        const transactionId = Number(txResult.lastInsertRowid);

        let feesTransactionId: number | null = null;
        if (feesCents > 0) {
          const subcategoryId = getBankFeesSubcategoryId(db, userId) ?? null;
          const paymentMethodId = getPrelevementPaymentMethodId(db, userId) ?? null;
          const feesTxResult = db
            .prepare(
              'INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)',
            )
            .run(
              userId,
              input.account_id,
              'expense',
              feesCents,
              `Frais — ${description}`,
              subcategoryId,
              input.date,
              paymentMethodId,
            );
          feesTransactionId = Number(feesTxResult.lastInsertRowid);
        }

        const opResult = db
          .prepare(
            'INSERT INTO stock_operations (user_id, account_id, transaction_id, fees_transaction_id, ticker, type, quantity, price_per_share, fees, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .run(
            userId,
            input.account_id,
            transactionId,
            feesTransactionId,
            input.ticker,
            'sell',
            input.quantity,
            input.price_per_share,
            feesCents,
            input.date,
          );
        const operationId = Number(opResult.lastInsertRowid);

        recalcPosition(db, input.account_id, input.ticker, userId);

        const operation = db
          .prepare<[number], StockOperation>('SELECT * FROM stock_operations WHERE id = ?')
          .get(operationId)!;

        return { operation: mapOperation(operation), transaction_id: transactionId };
      })();
    },

    getPositions: (accountId: number): StockPosition[] =>
      db
        .prepare<[number], StockPosition>(
          `SELECT sp.id, sp.account_id, sp.ticker, sp.quantity, sp.avg_price,
                  sprice.price      AS current_price,
                  COALESCE(sprice.currency, 'EUR') AS currency,
                  sprice.name       AS name,
                  sprice.fetched_at AS price_fetched_at,
                  sp.updated_at, sp.created_at
           FROM stock_positions sp
           LEFT JOIN stock_prices sprice ON sp.ticker = sprice.ticker
           WHERE sp.account_id = ?
           ORDER BY sp.ticker`,
        )
        .all(accountId)
        .map(mapPosition),

    getOperations: (accountId: number): StockOperation[] =>
      db
        .prepare<
          [number],
          StockOperation
        >('SELECT * FROM stock_operations WHERE account_id = ? ORDER BY date DESC, created_at DESC')
        .all(accountId)
        .map(mapOperation),

    getStockPrice: (ticker: string) => getStockPriceStmt.get({ ticker }) ?? undefined,
    getAllTickers: () => getAllTickersStmt.all(),
    upsertPrice: (ticker: string, price: number, currency: string, name: string | null) =>
      upsertPriceStmt.run({ ticker, price, currency, name }),

    getOperationById(operationId: number): StockOperation | undefined {
      const row =
        db
          .prepare<[number], StockOperation>('SELECT * FROM stock_operations WHERE id = ?')
          .get(operationId) ?? undefined;
      return row ? mapOperation(row) : undefined;
    },

    updateOperation(
      operationId: number,
      userId: number,
      input: {
        account_id: number;
        quantity: number;
        price_per_share: number;
        fees: number;
        date: string;
        description?: string;
      },
    ): StockOperation {
      return db.transaction(() => {
        const op = db
          .prepare<[number], StockOperation>('SELECT * FROM stock_operations WHERE id = ?')
          .get(operationId);
        if (!op) throw new Error('Opération introuvable');

        const feesCents = toCents(input.fees);
        const mainCents = Math.round(input.quantity * input.price_per_share * 100);

        if (op.type === 'sell' && mainCents - feesCents <= 0)
          throw new Error('Le montant net doit être positif');

        const description =
          input.description ??
          (op.type === 'buy'
            ? `Achat ${input.quantity} × ${op.ticker}`
            : `Vente ${input.quantity} × ${op.ticker}`);

        db.prepare(
          'UPDATE transactions SET amount = ?, description = ?, date = ? WHERE id = ?',
        ).run(mainCents, description, input.date, op.transaction_id);

        let newFeesTransactionId: number | null = op.fees_transaction_id ?? null;

        if (feesCents > 0) {
          if (op.fees_transaction_id) {
            db.prepare(
              'UPDATE transactions SET amount = ?, description = ?, date = ? WHERE id = ?',
            ).run(feesCents, `Frais — ${description}`, input.date, op.fees_transaction_id);
          } else {
            const subcategoryId = getBankFeesSubcategoryId(db, userId) ?? null;
            const paymentMethodId = getPrelevementPaymentMethodId(db, userId) ?? null;
            const feesTxResult = db
              .prepare(
                'INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)',
              )
              .run(
                userId,
                input.account_id,
                'expense',
                feesCents,
                `Frais — ${description}`,
                subcategoryId,
                input.date,
                paymentMethodId,
              );
            newFeesTransactionId = Number(feesTxResult.lastInsertRowid);
          }
        } else if (op.fees_transaction_id) {
          db.prepare('DELETE FROM transactions WHERE id = ?').run(op.fees_transaction_id);
          newFeesTransactionId = null;
        }

        db.prepare(
          'UPDATE stock_operations SET quantity = ?, price_per_share = ?, fees = ?, date = ?, fees_transaction_id = ? WHERE id = ?',
        ).run(
          input.quantity,
          input.price_per_share,
          feesCents,
          input.date,
          newFeesTransactionId,
          operationId,
        );

        recalcPosition(db, input.account_id, op.ticker, userId);

        const updatedOp = db
          .prepare<[number], StockOperation>('SELECT * FROM stock_operations WHERE id = ?')
          .get(operationId);
        if (!updatedOp) throw new Error('Opération introuvable après mise à jour');
        return mapOperation(updatedOp);
      })();
    },
  };
}
