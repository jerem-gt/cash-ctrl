import type { TaxYearData } from '@cashctrl/types';
import { describe, expect, it } from 'vitest';

import { computeAbattement, computePlafondPER, simulate } from './taxCalculator';

const YEAR_DATA_2025: TaxYearData = {
  year: 2025,
  params: {
    year: 2025,
    abattement_rate: 0.1,
    abattement_min: 495,
    abattement_max: 14171,
    pass: 47100,
    created_at: '',
  },
  brackets: [
    { id: 1, year: 2025, min_income: 0, max_income: 11497, rate: 0, created_at: '' },
    { id: 2, year: 2025, min_income: 11497, max_income: 29315, rate: 11, created_at: '' },
    { id: 3, year: 2025, min_income: 29315, max_income: 83823, rate: 30, created_at: '' },
    { id: 4, year: 2025, min_income: 83823, max_income: 180294, rate: 41, created_at: '' },
    { id: 5, year: 2025, min_income: 180294, max_income: null, rate: 45, created_at: '' },
  ],
};

describe('computeAbattement', () => {
  const params = YEAR_DATA_2025.params;

  it('applique 10% pour un revenu classique', () => {
    expect(computeAbattement(50000, params)).toBeCloseTo(5000);
  });

  it('respecte le minimum (495€)', () => {
    expect(computeAbattement(1000, params)).toBe(495);
  });

  it('respecte le maximum (14 171€)', () => {
    expect(computeAbattement(200000, params)).toBe(14171);
  });

  it('utilise les frais réels quand fournis', () => {
    expect(computeAbattement(50000, params, 8000)).toBe(8000);
  });

  it('ignore frais réels à 0 et applique le forfait', () => {
    expect(computeAbattement(50000, params, 0)).toBeCloseTo(5000);
  });
});

describe('computePlafondPER', () => {
  const params = YEAR_DATA_2025.params;

  it('retourne 10% du revenu pour un cas normal', () => {
    expect(computePlafondPER(60000, params)).toBeCloseTo(6000);
  });

  it('respecte le plancher (10% × PASS = 4 710€)', () => {
    expect(computePlafondPER(1000, params)).toBeCloseTo(4710);
  });

  it('respecte le plafond (80% × PASS = 37 680€)', () => {
    expect(computePlafondPER(500000, params)).toBeCloseTo(37680);
  });
});

describe('simulate', () => {
  it('calcule un impôt nul pour un revenu dans la tranche 0%', () => {
    const result = simulate(10000, 0, 1, YEAR_DATA_2025);
    expect(result.sansPER.impotTotal).toBe(0);
  });

  it("calcule l'impôt correctement sur la tranche 11% — cas simple", () => {
    // Revenu 20 000€, abattement 2 000€, imposable 18 000€
    // Tranche 11% : (18 000 - 11 497) × 0.11 = 6 503 × 0.11 = 715.33€
    const result = simulate(20000, 0, 1, YEAR_DATA_2025);
    expect(result.sansPER.revenuNetImposable).toBeCloseTo(18000);
    expect(result.sansPER.impotTotal).toBeCloseTo(715.33, 1);
  });

  it("calcule l'économie d'impôt avec versement PER dans la tranche 30%", () => {
    // Revenu 55 000€, abattement 5 500€, imposable 49 500€
    // Versement 4 000€ → imposable après PER : 45 500€
    const result = simulate(55000, 4000, 1, YEAR_DATA_2025);
    expect(result.plafondDepasse).toBe(false);
    expect(result.versementDeductible).toBe(4000);
    // économie = 4 000€ × 30% = 1 200€
    expect(result.economie).toBeCloseTo(1200, 0);
  });

  it('signale le dépassement du plafond PER', () => {
    // Revenu 50 000€, abattement 5 000€, imposable 45 000€
    // Plafond PER = max(4 500, min(4 500, 37 680)) = 4 500€
    const result = simulate(50000, 10000, 1, YEAR_DATA_2025);
    expect(result.plafondDepasse).toBe(true);
    expect(result.versementDeductible).toBeCloseTo(result.plafondPER);
  });

  it('économie est 0 quand le versement PER est 0', () => {
    const result = simulate(50000, 0, 1, YEAR_DATA_2025);
    expect(result.economie).toBe(0);
    expect(result.sansPER.impotTotal).toBe(result.avecPER.impotTotal);
  });

  it('calcul avec 2 parts (couple) donne un impôt inférieur', () => {
    const single = simulate(60000, 0, 1, YEAR_DATA_2025);
    const couple = simulate(60000, 0, 2, YEAR_DATA_2025);
    expect(couple.sansPER.impotTotal).toBeLessThan(single.sansPER.impotTotal);
  });

  it("utilise les frais réels à la place de l'abattement forfaitaire", () => {
    const forfait = simulate(50000, 0, 1, YEAR_DATA_2025);
    const fraisReels = simulate(50000, 0, 1, YEAR_DATA_2025, { fraisReels: 12000 });
    // Frais réels 12 000€ > abattement forfait 5 000€ → revenu imposable plus bas → impôt plus bas
    expect(fraisReels.sansPER.impotTotal).toBeLessThan(forfait.sansPER.impotTotal);
  });

  it('prend tout le versement en compte quand appliquerPlafond=false', () => {
    // Revenu 50 000€, versement 15 000€ (> plafond ~4 500€)
    const avecPlafond = simulate(50000, 15000, 1, YEAR_DATA_2025);
    const sansPlafond = simulate(50000, 15000, 1, YEAR_DATA_2025, { appliquerPlafond: false });
    expect(avecPlafond.versementDeductible).toBeLessThan(15000);
    expect(sansPlafond.versementDeductible).toBe(15000);
    expect(sansPlafond.plafondDepasse).toBe(false);
    expect(sansPlafond.economie).toBeGreaterThan(avecPlafond.economie);
  });

  it('plafondTotal est égal à plafondPER sans report', () => {
    const result = simulate(50000, 0, 1, YEAR_DATA_2025);
    expect(result.plafondTotal).toBe(result.plafondPER);
  });

  it('le report des années précédentes augmente le plafondTotal', () => {
    const result = simulate(50000, 0, 1, YEAR_DATA_2025, { reportAnneesPrecedentes: 3000 });
    expect(result.plafondTotal).toBeCloseTo(result.plafondPER + 3000);
  });

  it('un versement couvert par le report ne déclenche pas de dépassement', () => {
    // plafondPER 2025 pour 50 000€ = 4 710€, report = 3 000€ → total 7 710€
    const result = simulate(50000, 7000, 1, YEAR_DATA_2025, { reportAnneesPrecedentes: 3000 });
    expect(result.plafondDepasse).toBe(false);
    expect(result.versementDeductible).toBe(7000);
  });

  it('le plafond total est dépassé si versement > plafondPER + report', () => {
    // plafondPER = 4 710€, report = 3 000€ → total 7 710€, versement 10 000€ > 7 710€
    const result = simulate(50000, 10000, 1, YEAR_DATA_2025, { reportAnneesPrecedentes: 3000 });
    expect(result.plafondDepasse).toBe(true);
    expect(result.versementDeductible).toBeCloseTo(result.plafondTotal);
  });

  it('plafondBase fourni remplace le calcul depuis le revenu', () => {
    // Sans override : plafondPER calculé = 4 710€
    // Avec override 6 000€ : plafondPER = 6 000€ (valeur de l'avis d'imposition)
    const result = simulate(50000, 0, 1, YEAR_DATA_2025, { plafondBase: 6000 });
    expect(result.plafondPER).toBe(6000);
    expect(result.plafondTotal).toBe(6000);
  });

  it('revenu imposable avecPER ne peut pas être négatif', () => {
    const result = simulate(5000, 100000, 1, YEAR_DATA_2025);
    expect(result.avecPER.revenuNetImposable).toBeGreaterThanOrEqual(0);
  });

  it('calcule plusieurs tranches correctement pour un revenu élevé', () => {
    const result = simulate(120000, 0, 1, YEAR_DATA_2025);
    // doit avoir des montants non nuls dans les tranches 11%, 30% et 41%
    const d = result.sansPER.bracketDetails;
    expect(d.find((b) => b.rate === 11)?.tax).toBeGreaterThan(0);
    expect(d.find((b) => b.rate === 30)?.tax).toBeGreaterThan(0);
    expect(d.find((b) => b.rate === 41)?.tax).toBeGreaterThan(0);
  });
});
