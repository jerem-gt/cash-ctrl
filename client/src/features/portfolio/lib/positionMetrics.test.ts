import { describe, expect, it } from 'vitest';

import type { StockPosition } from '@/types';

import { getPnlColor, getPositionMetrics, getTotalMetrics } from './positionMetrics';

function makePos(overrides: Partial<StockPosition> = {}): StockPosition {
  return {
    id: 1,
    account_id: 1,
    ticker: 'TEST',
    quantity: 10,
    avg_price: 100,
    current_price: 120,
    currency: 'EUR',
    name: null,
    price_fetched_at: null,
    updated_at: '2026-01-01',
    created_at: '2026-01-01',
    ...overrides,
  };
}

describe('getPnlColor', () => {
  it('renvoie gris si pnl null', () => {
    expect(getPnlColor(null)).toBe('text-content-subtle');
  });

  it('renvoie vert si pnl > 0', () => {
    expect(getPnlColor(10)).toBe('text-success');
  });

  it('renvoie rouge si pnl < 0', () => {
    expect(getPnlColor(-5)).toBe('text-danger');
  });

  it('renvoie gris neutre si pnl exactement 0', () => {
    expect(getPnlColor(0)).toBe('text-content-muted');
  });
});

describe('getPositionMetrics', () => {
  it('calcule market/cost/pnl/pct pour une position rentable', () => {
    const m = getPositionMetrics(makePos({ quantity: 10, avg_price: 100, current_price: 120 }));
    expect(m.marketValue).toBe(1200);
    expect(m.costBasis).toBe(1000);
    expect(m.pnl).toBe(200);
    expect(m.pnlPct).toBe(20);
    expect(m.pnlColor).toBe('text-success');
  });

  it('renvoie marketValue/pnl null si current_price est null', () => {
    const m = getPositionMetrics(makePos({ current_price: null }));
    expect(m.marketValue).toBeNull();
    expect(m.pnl).toBeNull();
    expect(m.pnlPct).toBeNull();
    expect(m.pnlColor).toBe('text-content-subtle');
    expect(m.costBasis).toBe(1000);
  });

  it('renvoie pnlPct null si costBasis = 0 (avg_price 0)', () => {
    const m = getPositionMetrics(makePos({ avg_price: 0, current_price: 50 }));
    expect(m.pnlPct).toBeNull();
    expect(m.pnl).toBe(500);
  });

  it('couleur rouge sur une perte', () => {
    const m = getPositionMetrics(makePos({ avg_price: 200, current_price: 100 }));
    expect(m.pnl).toBe(-1000);
    expect(m.pnlColor).toBe('text-danger');
  });
});

describe('getTotalMetrics', () => {
  it('agrège plusieurs positions', () => {
    const positions = [
      makePos({ quantity: 10, avg_price: 100, current_price: 120 }),
      makePos({ quantity: 5, avg_price: 50, current_price: 60 }),
    ];
    const t = getTotalMetrics(positions);
    expect(t.totalMarketValue).toBe(1500);
    expect(t.totalCostBasis).toBe(1250);
    expect(t.totalPnl).toBe(250);
    expect(t.totalPnlPct).toBe(20);
    expect(t.totalPnlColor).toBe('text-success');
  });

  it('exclut les positions sans current_price des deux côtés (pas de perte fantôme)', () => {
    const positions = [
      makePos({ quantity: 10, avg_price: 100, current_price: null }),
      makePos({ quantity: 5, avg_price: 50, current_price: 60 }),
    ];
    const t = getTotalMetrics(positions);
    expect(t.totalMarketValue).toBe(300);
    expect(t.totalCostBasis).toBe(250);
    expect(t.totalPnl).toBe(50);
    expect(t.totalPnlPct).toBe(20);
    expect(t.totalPnlColor).toBe('text-success');
  });

  it('renvoie un total nul quand aucune position n’est cotée', () => {
    const positions = [makePos({ current_price: null }), makePos({ current_price: null })];
    const t = getTotalMetrics(positions);
    expect(t.totalMarketValue).toBe(0);
    expect(t.totalCostBasis).toBe(0);
    expect(t.totalPnl).toBe(0);
    expect(t.totalPnlPct).toBe(0);
  });

  it('renvoie totalPnlPct 0 quand costBasis = 0', () => {
    expect(getTotalMetrics([]).totalPnlPct).toBe(0);
  });
});
