import type { Database } from 'better-sqlite3';

import { logger } from '../../logger.js';
import { createStocksRepo } from './stocks.repo';
import { StockPrice } from './stocks.types';

const PRICE_TTL_MS = 15 * 60 * 1000;

async function fetchYahooPrice(ticker: string): Promise<StockPrice | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'cashctrl/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; currency?: string } }> };
    };
    const meta = data.chart?.result?.[0]?.meta as
      | { regularMarketPrice?: number; currency?: string; longName?: string; shortName?: string }
      | undefined;
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
  stocksRepo: ReturnType<typeof createStocksRepo>,
  ticker: string,
): Promise<StockPrice | null> {
  const fetched = await fetchYahooPrice(ticker);
  if (!fetched) return null;

  stocksRepo.upsertPrice(ticker, fetched.price, fetched.currency, fetched.name);
  return fetched;
}

export async function getOrRefreshPrice(
  stocksRepo: ReturnType<typeof createStocksRepo>,
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
