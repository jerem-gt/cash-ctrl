import type { StockPrice } from '@cashctrl/types';
import type { Database } from 'better-sqlite3';

import { logger } from '../../logger.js';
import { createStocksRepo } from './stocks.repo';

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

export interface PriceHistoryRepository {
  upsertPriceHistory(
    ticker: string,
    entries: Array<{ date: string; price: number; currency: string }>,
  ): void;
  hasPriceHistory(ticker: string): boolean;
}

export async function fetchAndStorePriceHistory(
  repo: PriceHistoryRepository,
  ticker: string,
): Promise<void> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1mo&range=10y`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'cashctrl/1.0' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return;

    const data = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: { currency?: string };
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: (number | null)[] }> };
        }>;
      };
    };

    const result = data.chart?.result?.[0];
    if (!result?.timestamp || !result.indicators?.quote?.[0]?.close) return;

    const currency = result.meta?.currency ?? 'EUR';
    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;
    const currentYear = new Date().getUTCFullYear();

    // Keep last available monthly close per calendar year (skip current year — use live prices)
    const yearData = new Map<number, number>();
    for (const [i, timestamp] of timestamps.entries()) {
      const close = closes[i];
      if (close == null || !Number.isFinite(close)) continue;
      const year = new Date(timestamp * 1000).getUTCFullYear();
      if (year >= currentYear) continue;
      yearData.set(year, close); // later iterations overwrite → last close of the year
    }

    const entries = Array.from(yearData.entries()).map(([year, price]) => ({
      date: `${year}-12-31`,
      price,
      currency,
    }));

    if (entries.length > 0) repo.upsertPriceHistory(ticker, entries);
  } catch {
    // Historical data is optional — fail silently
  }
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

async function refreshTickers(
  stocksRepo: ReturnType<typeof createStocksRepo>,
  tickers: string[],
): Promise<void> {
  for (const ticker of tickers) {
    const result = await refreshPrice(stocksRepo, ticker);
    if (!result) {
      logger.warn(`Failed to fetch price for ${ticker}`);
    }
  }
}

/** Rafraîchit toutes les cotes détenues, tous utilisateurs confondus (job de fond). */
export async function refreshAllPrices(db: Database): Promise<void> {
  const stocksRepo = createStocksRepo(db);
  await refreshTickers(stocksRepo, stocksRepo.getAllTickers());
}

/** Rafraîchit uniquement les cotes des comptes d'un utilisateur (déclenché à la demande). */
export async function refreshUserPrices(db: Database, userId: number): Promise<void> {
  const stocksRepo = createStocksRepo(db);
  await refreshTickers(stocksRepo, stocksRepo.getTickersForUser(userId));
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
