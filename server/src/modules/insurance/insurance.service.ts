import type { Database } from 'better-sqlite3';

import { logger } from '../../logger';
import { createStocksRepo } from '../stocks/stocks.repo';
import { refreshPrice } from '../stocks/stocks.service';
import { createInsuranceRepo } from './insurance.repo';

export function recalcUcPosition(
  db: Database,
  accountId: number,
  supportId: number,
  userId: number,
): void {
  const ops = db
    .prepare(
      `SELECT type, quantity, price_per_unit
       FROM insurance_operations
       WHERE account_id = :accountId AND support_id = :supportId
       ORDER BY date, id`,
    )
    .all({ accountId, supportId }) as Array<{
    type: string;
    quantity: number | null;
    price_per_unit: number | null;
  }>;

  let totalQty = 0;
  let avgPriceCents = 0;
  for (const { type, quantity, price_per_unit } of ops) {
    const qty = quantity ?? 0;
    const ppu = price_per_unit ?? 0;
    if (type === 'versement' || type === 'arbitrage_in') {
      const totalCost = totalQty * avgPriceCents + qty * ppu;
      totalQty += qty;
      avgPriceCents = totalQty > 0 ? totalCost / totalQty : 0;
    } else if (type === 'rachat' || type === 'arbitrage_out') {
      totalQty -= qty;
    }
  }

  if (totalQty <= 0) {
    db.prepare(
      'DELETE FROM insurance_positions WHERE account_id = :accountId AND support_id = :supportId',
    ).run({ accountId, supportId });
    return;
  }

  db.prepare(
    `INSERT INTO insurance_positions (user_id, account_id, support_id, quantity, avg_price, updated_at)
     VALUES (:userId, :accountId, :supportId, :quantity, :avgPrice, datetime('now'))
     ON CONFLICT(support_id) DO UPDATE SET
       quantity   = excluded.quantity,
       avg_price  = excluded.avg_price,
       updated_at = datetime('now')`,
  ).run({ userId, accountId, supportId, quantity: totalQty, avgPrice: avgPriceCents });
}

export async function refreshInsurancePrices(db: Database, accountId: number): Promise<void> {
  const insuranceRepo = createInsuranceRepo(db);
  const stocksRepo = createStocksRepo(db);
  const tickers = insuranceRepo.getUcTickers(accountId);

  for (const ticker of tickers) {
    const result = await refreshPrice(stocksRepo, ticker);
    if (!result) {
      logger.warn(`Failed to fetch UC price for ${ticker}`);
    }
  }
}
