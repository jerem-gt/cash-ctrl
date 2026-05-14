import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PriceRepository } from './stocks.service.js';
import { getOrRefreshPrice, refreshPrice, searchByQuery } from './stocks.service.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeRepo(cached?: {
  ticker: string;
  price: number;
  currency: string;
  fetched_at: string;
  name: string | null;
}): PriceRepository {
  return {
    getStockPrice: vi.fn().mockReturnValue(cached),
    upsertPrice: vi.fn(),
  };
}

function mockFetchJson(body: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) }));
}

// ─── searchByQuery ────────────────────────────────────────────────────────────

describe('searchByQuery', () => {
  it('retourne les résultats filtrés (EQUITY, ETF, FUND, MUTUALFUND)', async () => {
    mockFetchJson({
      quotes: [
        { symbol: 'DCAM.PA', longname: 'Décathlon SA', exchDisp: 'Paris', quoteType: 'EQUITY' },
        { symbol: 'WLDS.PA', shortname: 'MSCI World ETF', exchDisp: 'Paris', quoteType: 'ETF' },
        { symbol: 'DCAM.OPT', exchDisp: 'OTC', quoteType: 'OPTION' },
      ],
    });
    const results = await searchByQuery('FR0014000MR3');
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      symbol: 'DCAM.PA',
      name: 'Décathlon SA',
      exchange: 'Paris',
      type: 'EQUITY',
    });
    expect(results[1].type).toBe('ETF');
  });

  it('utilise shortname quand longname est absent', async () => {
    mockFetchJson({
      quotes: [{ symbol: 'AAPL', shortname: 'Apple Inc', exchange: 'NMS', quoteType: 'EQUITY' }],
    });
    const results = await searchByQuery('US0378331005');
    expect(results[0].name).toBe('Apple Inc');
    expect(results[0].exchange).toBe('NMS');
  });

  it('utilise exchange quand exchDisp est absent', async () => {
    mockFetchJson({
      quotes: [{ symbol: 'X', longname: 'X Corp', exchange: 'NYSE', quoteType: 'EQUITY' }],
    });
    const [r] = await searchByQuery('US0000000001');
    expect(r.exchange).toBe('NYSE');
  });

  it('retourne [] quand la réponse HTTP est non-ok', async () => {
    mockFetchJson({}, false);
    expect(await searchByQuery('FR0014000MR3')).toEqual([]);
  });

  it('retourne [] quand fetch lance une exception', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await searchByQuery('FR0014000MR3')).toEqual([]);
  });

  it('retourne [] quand quotes est absent de la réponse', async () => {
    mockFetchJson({});
    expect(await searchByQuery('query')).toEqual([]);
  });

  it('filtre les entrées sans symbole', async () => {
    mockFetchJson({
      quotes: [{ longname: 'Sans symbole', exchDisp: 'Paris', quoteType: 'EQUITY' }],
    });
    expect(await searchByQuery('FR0014000MR3')).toEqual([]);
  });
});

// ─── refreshPrice ─────────────────────────────────────────────────────────────

describe('refreshPrice', () => {
  it('récupère le prix et appelle upsertPrice', async () => {
    const repo = makeRepo();
    mockFetchJson({
      chart: {
        result: [{ meta: { regularMarketPrice: 15.5, currency: 'EUR', longName: 'Décathlon' } }],
      },
    });
    const result = await refreshPrice(repo, 'DCAM.PA');
    expect(result?.price).toBe(15.5);
    expect(result?.currency).toBe('EUR');
    expect(repo.upsertPrice).toHaveBeenCalledWith('DCAM.PA', 15.5, 'EUR', 'Décathlon');
  });

  it('retourne null quand regularMarketPrice est absent', async () => {
    const repo = makeRepo();
    mockFetchJson({ chart: { result: [{ meta: {} }] } });
    expect(await refreshPrice(repo, 'DCAM.PA')).toBeNull();
  });

  it('retourne null quand la réponse HTTP est non-ok', async () => {
    const repo = makeRepo();
    mockFetchJson({}, false);
    expect(await refreshPrice(repo, 'DCAM.PA')).toBeNull();
  });

  it('retourne null quand fetch lance une exception', async () => {
    const repo = makeRepo();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await refreshPrice(repo, 'DCAM.PA')).toBeNull();
  });

  it('utilise shortName quand longName est absent', async () => {
    const repo = makeRepo();
    mockFetchJson({
      chart: {
        result: [{ meta: { regularMarketPrice: 10, currency: 'USD', shortName: 'Apple' } }],
      },
    });
    const result = await refreshPrice(repo, 'AAPL');
    expect(result?.name).toBe('Apple');
  });
});

// ─── getOrRefreshPrice ────────────────────────────────────────────────────────

describe('getOrRefreshPrice', () => {
  const freshCached = {
    ticker: 'DCAM.PA',
    price: 15,
    currency: 'EUR',
    fetched_at: new Date().toISOString(),
    name: 'Décathlon',
  };
  const staleCached = {
    ...freshCached,
    price: 14,
    fetched_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  };

  it('retourne le cache frais sans appeler fetch', async () => {
    const repo = makeRepo(freshCached);
    vi.stubGlobal('fetch', vi.fn());
    const result = await getOrRefreshPrice(repo, 'DCAM.PA');
    expect(result?.price).toBe(15);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rafraîchit quand le cache est périmé', async () => {
    const repo = makeRepo(staleCached);
    mockFetchJson({
      chart: { result: [{ meta: { regularMarketPrice: 16, currency: 'EUR' } }] },
    });
    const result = await getOrRefreshPrice(repo, 'DCAM.PA');
    expect(result?.price).toBe(16);
    expect(fetch).toHaveBeenCalled();
  });

  it('retourne le cache périmé en fallback si le fetch échoue', async () => {
    const repo = makeRepo(staleCached);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const result = await getOrRefreshPrice(repo, 'DCAM.PA');
    expect(result?.price).toBe(14);
  });

  it('retourne null quand pas de cache et fetch échoue', async () => {
    const repo = makeRepo();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await getOrRefreshPrice(repo, 'DCAM.PA')).toBeNull();
  });
});
