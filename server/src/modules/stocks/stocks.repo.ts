import type { StockOperation, StockPosition, StockPrice } from '@cashctrl/types';
import type { Database } from 'better-sqlite3';

import { checkAccountOwnership, getAccountEnvelopeType } from '../../lib/accountHelpers';
import { getSystemRefs, getTransferIds } from '../../lib/administrationDataConstants';
import { BadRequestError, NotFoundError } from '../../lib/errors';
import { insertFeesTransaction } from '../../lib/insertFeesTransaction';
import { toCents, toEuros } from '../../lib/money';
import { BuyInput, SellInput, TransferInput } from './stocks.types';

function mapOperation(row: StockOperation): StockOperation {
  return { ...row, fees: toEuros(row.fees) };
}

function insertStockTxAndOp(
  db: Database,
  userId: number,
  input: {
    account_id: number;
    ticker: string;
    quantity: number;
    price_per_share: number;
    date: string;
    description?: string;
  },
  txType: 'expense' | 'income',
  opType: 'buy' | 'sell',
  mainCents: number,
  feesCents: number,
): { operation: StockOperation; transaction_id: number } {
  const descriptionPrefix = opType === 'buy' ? 'Achat' : 'Vente';
  const description =
    input.description ?? `${descriptionPrefix} ${input.quantity} × ${input.ticker}`;
  const txResult = db
    .prepare(
      'INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, notes, validated) VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, NULL, 1)',
    )
    .run(userId, input.account_id, txType, mainCents, description, input.date);
  const transactionId = Number(txResult.lastInsertRowid);

  const feesTransactionId = insertFeesTransaction(
    db,
    userId,
    input.account_id,
    feesCents,
    `Frais — ${description}`,
    input.date,
  );

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
      opType,
      input.quantity,
      input.price_per_share,
      feesCents,
      input.date,
    );

  const operation = db
    .prepare<[number], StockOperation>('SELECT * FROM stock_operations WHERE id = ?')
    .get(Number(opResult.lastInsertRowid))!;

  return { operation: mapOperation(operation), transaction_id: transactionId };
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

  const upsertPriceHistoryStmt = db.prepare(`
    INSERT OR REPLACE INTO stock_price_history (ticker, date, price, currency)
    VALUES (:ticker, :date, :price, :currency)
  `);

  const getPriceHistoryStmt = db.prepare<
    { ticker: string },
    { date: string; price: number; currency: string }
  >(`SELECT date, price, currency FROM stock_price_history WHERE ticker = :ticker ORDER BY date`);

  const hasPriceHistoryStmt = db.prepare<{ ticker: string }, { cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM stock_price_history WHERE ticker = :ticker`,
  );

  const getTickersForUserStmt = db
    .prepare<[number], string>(
      `SELECT DISTINCT so.ticker
       FROM stock_operations so
       JOIN accounts a ON a.id = so.account_id
       WHERE a.user_id = ? AND a.closed_at IS NULL`,
    )
    .pluck();

  const getOpsForPositionStmt = db.prepare<
    { accountId: number; ticker: string },
    { type: string; quantity: number; price_per_share: number }
  >(
    `SELECT type, quantity, price_per_share FROM stock_operations
     WHERE account_id = :accountId AND ticker = :ticker ORDER BY date, id`,
  );
  const deletePositionStmt = db.prepare<{ accountId: number; ticker: string }>(
    'DELETE FROM stock_positions WHERE account_id = :accountId AND ticker = :ticker',
  );
  const upsertPositionStmt = db.prepare(
    `INSERT INTO stock_positions (user_id, account_id, ticker, quantity, avg_price, updated_at)
     VALUES (:userId, :accountId, :ticker, :quantity, :avgPrice, datetime('now'))
     ON CONFLICT(account_id, ticker) DO UPDATE SET
       quantity   = excluded.quantity,
       avg_price  = excluded.avg_price,
       updated_at = datetime('now')`,
  );
  const isFeesTransactionStmt = db
    .prepare<[number], number>('SELECT 1 FROM stock_operations WHERE fees_transaction_id = ?')
    .pluck();
  const getOpByTransactionIdStmt = db.prepare<[number], { account_id: number; ticker: string }>(
    'SELECT account_id, ticker FROM stock_operations WHERE transaction_id = ?',
  );
  const getOpByIdStmt = db.prepare<[number], StockOperation>(
    'SELECT * FROM stock_operations WHERE id = ?',
  );

  return {
    accountBelongsToUser: (accountId: number, userId: number): boolean =>
      checkAccountOwnership(db, accountId, userId),

    isInvestmentAccount: (accountId: number): boolean =>
      getAccountEnvelopeType(db, accountId) === 'investment',

    buy(userId: number, input: BuyInput): { operation: StockOperation; transaction_id: number } {
      const feesCents = toCents(input.fees);
      const mainCents = toCents(input.quantity * input.price_per_share);

      return db.transaction(() =>
        insertStockTxAndOp(db, userId, input, 'expense', 'buy', mainCents, feesCents),
      )();
    },

    sell(userId: number, input: SellInput): { operation: StockOperation; transaction_id: number } {
      const position = db
        .prepare<
          [number, string],
          { quantity: number }
        >('SELECT quantity FROM stock_positions WHERE account_id = ? AND ticker = ?')
        .get(input.account_id, input.ticker);

      if (!position || position.quantity < input.quantity) {
        throw new BadRequestError('stock.insufficient_position', {
          available: position?.quantity ?? 0,
        });
      }

      const feesCents = toCents(input.fees);
      const mainCents = toCents(input.quantity * input.price_per_share);
      if (mainCents - feesCents <= 0) {
        throw new BadRequestError('stock.net_amount_after_fees_positive');
      }

      return db.transaction(() =>
        insertStockTxAndOp(db, userId, input, 'income', 'sell', mainCents, feesCents),
      )();
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
        .all(accountId),

    getOperations: (accountId: number): StockOperation[] =>
      db
        .prepare<
          [number],
          StockOperation
        >('SELECT * FROM stock_operations WHERE account_id = ? ORDER BY date DESC, created_at DESC')
        .all(accountId)
        .map(mapOperation),

    transfer(
      userId: number,
      input: TransferInput,
    ): { outOperation: StockOperation; inOperation: StockOperation } {
      const position = db
        .prepare<
          [number, string],
          { quantity: number; avg_price: number }
        >('SELECT quantity, avg_price FROM stock_positions WHERE account_id = ? AND ticker = ?')
        .get(input.from_account_id, input.ticker);

      if (!position || position.quantity < input.quantity) {
        throw new BadRequestError('stock.insufficient_position', {
          available: position?.quantity ?? 0,
        });
      }

      const avgPrice = position.avg_price;

      const description = `Transfert ${input.quantity} × ${input.ticker}`;
      const amountCents = toCents(input.quantity * avgPrice);

      return db.transaction(() => {
        const { subcategoryId, paymentMethodId } = getTransferIds(db, userId);

        const expenseTxResult = db
          .prepare(
            'INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, notes, validated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)',
          )
          .run(
            userId,
            input.from_account_id,
            'expense',
            amountCents,
            description,
            subcategoryId ?? null,
            input.date,
            paymentMethodId ?? null,
          );
        const expenseTxId = Number(expenseTxResult.lastInsertRowid);

        const incomeTxResult = db
          .prepare(
            'INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, notes, validated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)',
          )
          .run(
            userId,
            input.to_account_id,
            'income',
            amountCents,
            description,
            subcategoryId ?? null,
            input.date,
            paymentMethodId ?? null,
          );
        const incomeTxId = Number(incomeTxResult.lastInsertRowid);

        db.prepare('UPDATE transactions SET transfer_peer_id = ? WHERE id = ?').run(
          incomeTxId,
          expenseTxId,
        );
        db.prepare('UPDATE transactions SET transfer_peer_id = ? WHERE id = ?').run(
          expenseTxId,
          incomeTxId,
        );

        const outResult = db
          .prepare(
            'INSERT INTO stock_operations (user_id, account_id, transaction_id, fees_transaction_id, ticker, type, quantity, price_per_share, fees, date) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 0, ?)',
          )
          .run(
            userId,
            input.from_account_id,
            expenseTxId,
            input.ticker,
            'transfer_out',
            input.quantity,
            avgPrice,
            input.date,
          );
        const outId = Number(outResult.lastInsertRowid);

        const inResult = db
          .prepare(
            'INSERT INTO stock_operations (user_id, account_id, transaction_id, fees_transaction_id, ticker, type, quantity, price_per_share, fees, date, transfer_peer_id) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 0, ?, ?)',
          )
          .run(
            userId,
            input.to_account_id,
            incomeTxId,
            input.ticker,
            'transfer_in',
            input.quantity,
            avgPrice,
            input.date,
            outId,
          );
        const inId = Number(inResult.lastInsertRowid);

        db.prepare('UPDATE stock_operations SET transfer_peer_id = ? WHERE id = ?').run(
          inId,
          outId,
        );

        const outOp = getOpByIdStmt.get(outId)!;
        const inOp = getOpByIdStmt.get(inId)!;

        return { outOperation: mapOperation(outOp), inOperation: mapOperation(inOp) };
      })();
    },

    getStockPrice: (ticker: string) => getStockPriceStmt.get({ ticker }) ?? undefined,
    getAllTickers: () => getAllTickersStmt.all(),
    upsertPrice: (ticker: string, price: number, currency: string, name: string | null) =>
      upsertPriceStmt.run({ ticker, price, currency, name }),

    upsertPriceHistory(
      ticker: string,
      entries: Array<{ date: string; price: number; currency: string }>,
    ): void {
      db.transaction(() => {
        for (const e of entries) {
          upsertPriceHistoryStmt.run({
            ticker,
            date: e.date,
            price: e.price,
            currency: e.currency,
          });
        }
      })();
    },

    getPriceHistory: (ticker: string) => getPriceHistoryStmt.all({ ticker }),

    hasPriceHistory: (ticker: string): boolean =>
      (hasPriceHistoryStmt.get({ ticker })?.cnt ?? 0) > 0,

    getTickersForUser: (userId: number): string[] => getTickersForUserStmt.all(userId),

    getOperationById(operationId: number): StockOperation | undefined {
      const row = getOpByIdStmt.get(operationId) ?? undefined;
      return row ? mapOperation(row) : undefined;
    },

    isFeesTransaction: (transactionId: number): boolean =>
      isFeesTransactionStmt.get(transactionId) !== undefined,

    getOperationByTransactionId: (transactionId: number) =>
      getOpByTransactionIdStmt.get(transactionId) ?? undefined,

    /**
     * Recalcule la position (quantité + PRU) d'un ticker à partir de ses opérations.
     * Supprime la position si la quantité tombe à zéro.
     */
    recalcPosition(accountId: number, ticker: string, userId: number): void {
      const ops = getOpsForPositionStmt.all({ accountId, ticker });

      let totalQty = 0;
      let avgPrice = 0;
      for (const { type, quantity, price_per_share } of ops) {
        if (type === 'buy' || type === 'transfer_in') {
          const totalCost = totalQty * avgPrice + quantity * price_per_share;
          totalQty += quantity;
          avgPrice = totalQty > 0 ? totalCost / totalQty : 0;
        } else {
          totalQty -= quantity;
        }
      }

      if (totalQty <= 0) {
        deletePositionStmt.run({ accountId, ticker });
        return;
      }

      upsertPositionStmt.run({ userId, accountId, ticker, quantity: totalQty, avgPrice });
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
        const op = getOpByIdStmt.get(operationId);
        if (!op) throw new NotFoundError('stock.operation_not_found');

        const feesCents = toCents(input.fees);
        const mainCents = toCents(input.quantity * input.price_per_share);

        if (op.type === 'sell' && mainCents - feesCents <= 0)
          throw new BadRequestError('stock.net_amount_positive');

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
            const refs = getSystemRefs(db, userId);
            const subcategoryId = refs.bankFeesSubcategoryId ?? null;
            const paymentMethodId = refs.prelevementPaymentMethodId ?? null;
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

        const updatedOp = getOpByIdStmt.get(operationId);
        if (!updatedOp) throw new Error('Opération introuvable après mise à jour');
        return mapOperation(updatedOp);
      })();
    },
  };
}
