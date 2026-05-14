import type { Database } from 'better-sqlite3';

import { logger } from '../../logger.js';
import { createStocksRepo } from './stocks.repo';
import { StockPrice } from './stocks.types';

const PRICE_TTL_MS = 15 * 60 * 1000;

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export async function searchByQuery(query: string): Promise<StockSearchResult[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'cashctrl/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      quotes?: Array<{
        symbol?: string;
        shortname?: string;
        longname?: string;
        exchange?: string;
        exchDisp?: string;
        quoteType?: string;
      }>;
    };
    const ALLOWED_TYPES = new Set(['EQUITY', 'ETF', 'FUND', 'MUTUALFUND']);
    return (data.quotes ?? [])
      .filter((q) => q.symbol && ALLOWED_TYPES.has(q.quoteType ?? ''))
      .map((q) => ({
        symbol: q.symbol!,
        name: q.longname ?? q.shortname ?? q.symbol!,
        exchange: q.exchDisp ?? q.exchange ?? '',
        type: q.quoteType ?? '',
      }));
  } catch {
    return [];
  }
}

export interface PriceRepository {
  getStockPrice(ticker: string): StockPrice | undefined;
  upsertPrice(ticker: string, price: number, currency: string, name: string | null): unknown;
}

async function fetchYahooPrice(ticker: string): Promise<StockPrice | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'cashctrl/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            currency?: string;
            longName?: string;
            shortName?: string;
          };
        }>;
      };
    };
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    return {
      ticker: ticker,
      price: meta.regularMarketPrice,
      currency: meta.currency ?? 'EUR',
      name: meta.longName ?? meta.shortName ?? null,
      fetched_at: '',
    };
  } catch {
    return null;
  }
}

export async function refreshPrice(
  stocksRepo: PriceRepository,
  ticker: string,
): Promise<StockPrice | null> {
  const fetched = await fetchYahooPrice(ticker);
  if (!fetched) return null;

  stocksRepo.upsertPrice(ticker, fetched.price, fetched.currency, fetched.name);
  return fetched;
}

export async function getOrRefreshPrice(
  stocksRepo: PriceRepository,
  ticker: string,
): Promise<StockPrice | null> {
  const cached = stocksRepo.getStockPrice(ticker);

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age < PRICE_TTL_MS) return cached;
  }

  const fetched = await refreshPrice(stocksRepo, ticker);
  return fetched ?? cached ?? null;
}

export async function refreshAllPrices(db: Database): Promise<void> {
  const stocksRepo = createStocksRepo(db);
  const tickers = stocksRepo.getAllTickers();

  for (const ticker of tickers) {
    const result = await refreshPrice(stocksRepo, ticker);
    if (!result) {
      logger.warn(`Failed to fetch price for ${ticker}`);
    }
  }
}

export function startPriceRefreshInterval(
  db: Database,
  intervalMs = 30 * 60 * 1000,
): NodeJS.Timeout {
  return setInterval(() => {
    refreshAllPrices(db).catch((err: unknown) => {
      logger.error(`Price refresh error: ${String(err)}`);
    });
  }, intervalMs);
}

export function recalcPosition(
  db: Database,
  accountId: number,
  ticker: string,
  userId: number,
): void {
  const ops = db
    .prepare(
      'SELECT type, quantity, price_per_share FROM stock_operations WHERE account_id = :accountId AND ticker = :ticker ORDER BY date, id',
    )
    .all({ accountId, ticker }) as Array<{
    type: string;
    quantity: number;
    price_per_share: number;
  }>;

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
    db.prepare(
      'DELETE FROM stock_positions WHERE account_id = :accountId AND ticker = :ticker',
    ).run({ accountId, ticker });
    return;
  }

  db.prepare(
    `INSERT INTO stock_positions (user_id, account_id, ticker, quantity, avg_price, updated_at)
     VALUES (:userId, :accountId, :ticker, :quantity, :avgPrice, datetime('now'))
     ON CONFLICT(account_id, ticker) DO UPDATE SET
       quantity   = excluded.quantity,
       avg_price  = excluded.avg_price,
       updated_at = datetime('now')`,
  ).run({ userId, accountId, ticker, quantity: totalQty, avgPrice });
}
