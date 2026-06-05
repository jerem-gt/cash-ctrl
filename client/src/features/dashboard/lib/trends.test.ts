import { describe, expect, it } from 'vitest';

import { deltaTrend, pctTrend } from './trends';

describe('pctTrend', () => {
  it('retourne flat si prev === 0 et current === 0', () => {
    expect(pctTrend(0, 0, true)?.direction).toBe('flat');
  });

  it('retourne undefined si prev === 0 et current !== 0 (pas de base de comparaison)', () => {
    expect(pctTrend(100, 0, true)).toBeUndefined();
  });

  it('retourne flat si la variation arrondie vaut 0', () => {
    expect(pctTrend(1001, 1000, true)?.direction).toBe('flat');
  });

  it('hausse de revenus (higherIsBetter=true) : up + positif', () => {
    const r = pctTrend(1200, 1000, true);
    expect(r?.direction).toBe('up');
    expect(r?.positive).toBe(true);
    expect(r?.value).toBe('20 %');
  });

  it('hausse de dépenses (higherIsBetter=false) : up + négatif', () => {
    const r = pctTrend(1200, 1000, false);
    expect(r?.direction).toBe('up');
    expect(r?.positive).toBe(false);
  });

  it('baisse de revenus (higherIsBetter=true) : down + négatif', () => {
    const r = pctTrend(800, 1000, true);
    expect(r?.direction).toBe('down');
    expect(r?.positive).toBe(false);
    expect(r?.value).toBe('20 %');
  });

  it('baisse de dépenses (higherIsBetter=false) : down + positif', () => {
    const r = pctTrend(800, 1000, false);
    expect(r?.direction).toBe('down');
    expect(r?.positive).toBe(true);
  });

  it('gère une base négative (valeur absolue pour le calcul)', () => {
    const r = pctTrend(-500, -1000, true);
    expect(r?.direction).toBe('up');
    expect(r?.value).toBe('50 %');
  });
});

describe('deltaTrend', () => {
  it('retourne flat si diff === 0', () => {
    expect(deltaTrend(1000, 1000).direction).toBe('flat');
  });

  it('retourne flat si diff arrondie est 0 (centimes ignorés)', () => {
    expect(deltaTrend(1000.4, 1000.3).direction).toBe('flat');
  });

  it('retourne up + positif si current > prev', () => {
    const r = deltaTrend(1500, 1000);
    expect(r.direction).toBe('up');
    expect(r.positive).toBe(true);
  });

  it('retourne down + négatif si current < prev', () => {
    const r = deltaTrend(500, 1000);
    expect(r.direction).toBe('down');
    expect(r.positive).toBe(false);
  });

  it('affiche la valeur absolue de la différence', () => {
    expect(deltaTrend(500, 1000).value).toContain('500');
    expect(deltaTrend(1500, 1000).value).toContain('500');
  });
});
