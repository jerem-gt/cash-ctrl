import type { Database } from 'better-sqlite3';

import { logger } from '../../logger.js';

const PRICE_TTL_MS = 15 * 60 * 1000;

interface YahooPrice {
  price: number;
  currency: string;
}

async function fetchYahooPrice(ticker: string): Promise<YahooPrice | null> {
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
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    return { price: meta.regularMarketPrice, currency: meta.currency ?? 'EUR' };
  } catch {
    return null;
  }
}

export async function refreshPrice(db: Database, ticker: string): Promise<YahooPrice | null> {
  const fetched = await fetchYahooPrice(ticker);
  if (!fetched) return null;
  db.prepare(
    "INSERT OR REPLACE INTO stock_prices (ticker, price, currency, fetched_at) VALUES (?, ?, ?, datetime('now'))",
  ).run(ticker, fetched.price, fetched.currency);
  return fetched;
}

export async function getOrRefreshPrice(
  db: Database,
  ticker: string,
): Promise<{ price: number; currency: string; fetched_at: string } | null> {
  const cached = db
    .prepare<
      [string],
      { price: number; currency: string; fetched_at: string }
    >('SELECT price, currency, fetched_at FROM stock_prices WHERE ticker = ?')
    .get(ticker);

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age < PRICE_TTL_MS) return cached;
  }

  const fetched = await refreshPrice(db, ticker);
  if (!fetched) return cached ?? null;

  return (
    db
      .prepare<
        [string],
        { price: number; currency: string; fetched_at: string }
      >('SELECT price, currency, fetched_at FROM stock_prices WHERE ticker = ?')
      .get(ticker) ?? null
  );
}

export async function refreshAllPrices(db: Database): Promise<void> {
  const tickers = db
    .prepare<
      [],
      { ticker: string }
    >('SELECT DISTINCT ticker FROM stock_positions WHERE quantity > 0')
    .all();

  for (const { ticker } of tickers) {
    const result = await refreshPrice(db, ticker);
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
