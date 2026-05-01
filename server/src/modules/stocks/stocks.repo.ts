import type { Database } from 'better-sqlite3';

import type { BuyInput, SellInput, StockOperation, StockPosition } from './stocks.types';

export function createStocksRepo(db: Database) {
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

    getPositions(accountId: number): StockPosition[] {
      return db
        .prepare<[number], StockPosition>(
          `SELECT sp.id, sp.account_id, sp.ticker, sp.quantity, sp.avg_price,
                  sprice.price      AS current_price,
                  COALESCE(sprice.currency, 'EUR') AS currency,
                  sprice.fetched_at AS price_fetched_at,
                  sp.updated_at, sp.created_at
           FROM stock_positions sp
           LEFT JOIN stock_prices sprice ON sp.ticker = sprice.ticker
           WHERE sp.account_id = ?
           ORDER BY sp.ticker`,
        )
        .all(accountId);
    },

    getPosition(accountId: number, ticker: string): StockPosition | undefined {
      return (
        db
          .prepare<[number, string], StockPosition>(
            `SELECT sp.id, sp.account_id, sp.ticker, sp.quantity, sp.avg_price,
                    sprice.price      AS current_price,
                    COALESCE(sprice.currency, 'EUR') AS currency,
                    sprice.fetched_at AS price_fetched_at,
                    sp.updated_at, sp.created_at
             FROM stock_positions sp
             LEFT JOIN stock_prices sprice ON sp.ticker = sprice.ticker
             WHERE sp.account_id = ? AND sp.ticker = ?`,
          )
          .get(accountId, ticker) ?? undefined
      );
    },

    getOperations(accountId: number): StockOperation[] {
      return db
        .prepare<
          [number],
          StockOperation
        >('SELECT * FROM stock_operations WHERE account_id = ? ORDER BY date DESC, created_at DESC')
        .all(accountId);
    },

    buy(userId: number, input: BuyInput): { operation: StockOperation; transaction_id: number } {
      const totalAmount = input.quantity * input.price_per_share + input.fees;
      const description = input.description ?? `Achat ${input.quantity} × ${input.ticker}`;

      return db.transaction(() => {
        const txResult = db
          .prepare(
            'INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, notes) VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, NULL)',
          )
          .run(userId, input.account_id, 'expense', totalAmount, description, input.date);
        const transactionId = Number(txResult.lastInsertRowid);

        const opResult = db
          .prepare(
            'INSERT INTO stock_operations (account_id, transaction_id, ticker, type, quantity, price_per_share, fees, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .run(
            input.account_id,
            transactionId,
            input.ticker,
            'buy',
            input.quantity,
            input.price_per_share,
            input.fees,
            input.date,
          );
        const operationId = Number(opResult.lastInsertRowid);

        // Upsert position: update avg_price (PRU) and quantity
        db.prepare(
          `INSERT INTO stock_positions (account_id, ticker, quantity, avg_price, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(account_id, ticker) DO UPDATE SET
             avg_price  = (quantity * avg_price + excluded.quantity * excluded.avg_price) / (quantity + excluded.quantity),
             quantity   = quantity + excluded.quantity,
             updated_at = datetime('now')`,
        ).run(input.account_id, input.ticker, input.quantity, input.price_per_share);

        const operation = db
          .prepare<[number], StockOperation>('SELECT * FROM stock_operations WHERE id = ?')
          .get(operationId)!;

        return { operation, transaction_id: transactionId };
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

      const totalAmount = input.quantity * input.price_per_share - input.fees;
      if (totalAmount <= 0) {
        throw new Error('Le montant net après frais doit être positif');
      }

      const description = input.description ?? `Vente ${input.quantity} × ${input.ticker}`;

      return db.transaction(() => {
        const txResult = db
          .prepare(
            'INSERT INTO transactions (user_id, account_id, type, amount, description, subcategory_id, date, payment_method_id, notes) VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, NULL)',
          )
          .run(userId, input.account_id, 'income', totalAmount, description, input.date);
        const transactionId = Number(txResult.lastInsertRowid);

        const opResult = db
          .prepare(
            'INSERT INTO stock_operations (account_id, transaction_id, ticker, type, quantity, price_per_share, fees, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .run(
            input.account_id,
            transactionId,
            input.ticker,
            'sell',
            input.quantity,
            input.price_per_share,
            input.fees,
            input.date,
          );
        const operationId = Number(opResult.lastInsertRowid);

        const newQty = position.quantity - input.quantity;
        if (newQty === 0) {
          db.prepare('DELETE FROM stock_positions WHERE account_id = ? AND ticker = ?').run(
            input.account_id,
            input.ticker,
          );
        } else {
          db.prepare(
            "UPDATE stock_positions SET quantity = ?, updated_at = datetime('now') WHERE account_id = ? AND ticker = ?",
          ).run(newQty, input.account_id, input.ticker);
        }

        const operation = db
          .prepare<[number], StockOperation>('SELECT * FROM stock_operations WHERE id = ?')
          .get(operationId)!;

        return { operation, transaction_id: transactionId };
      })();
    },

    getAllTickers(): string[] {
      return db
        .prepare<[], { ticker: string }>(
          'SELECT DISTINCT ticker FROM stock_positions WHERE quantity > 0',
        )
        .all()
        .map((r) => r.ticker);
    },

    upsertPrice(ticker: string, price: number, currency: string): void {
      db.prepare(
        "INSERT OR REPLACE INTO stock_prices (ticker, price, currency, fetched_at) VALUES (?, ?, ?, datetime('now'))",
      ).run(ticker, price, currency);
    },
  };
}
