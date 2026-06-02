import '@/i18n';

import i18n from 'i18next';
import { describe, expect, it } from 'vitest';

import { formatAnnualized, formatDuration, getGainColor, totalMonthsSince } from './profitability';

const t = i18n.getFixedT('fr', 'dashboard');
const NOW = new Date('2026-05-31').getTime();

describe('getGainColor', () => {
  it('vert si gain positif', () => {
    expect(getGainColor(true)).toBe('text-success');
  });
  it('rouge sinon', () => {
    expect(getGainColor(false)).toBe('text-danger');
  });
});

describe('formatAnnualized', () => {
  it('renvoie "—" pour null', () => {
    expect(formatAnnualized(null)).toBe('—');
  });
  it('préfixe + pour un gain', () => {
    expect(formatAnnualized(12.3)).toBe('+12.3 %');
  });
  it('garde le - pour une perte', () => {
    expect(formatAnnualized(-5)).toBe('-5.0 %');
  });
  it('inclut le 0 avec un signe +', () => {
    expect(formatAnnualized(0)).toBe('+0.0 %');
  });
  it('arrondit à 1 décimale', () => {
    expect(formatAnnualized(3.14159)).toBe('+3.1 %');
  });
});

describe('totalMonthsSince', () => {
  it('renvoie 0 pour le jour même', () => {
    expect(totalMonthsSince('2026-05-31', NOW)).toBe(0);
  });
  it('renvoie le nombre de mois pour quelques mois', () => {
    expect(totalMonthsSince('2026-01-31', NOW)).toBe(3);
  });
  it('renvoie 12 pour 1 an', () => {
    expect(totalMonthsSince('2025-05-31', NOW)).toBeGreaterThanOrEqual(11);
    expect(totalMonthsSince('2025-05-31', NOW)).toBeLessThanOrEqual(12);
  });
});

describe('formatDuration', () => {
  it('renvoie "N mois" si moins d\'un an', () => {
    expect(formatDuration('2026-01-31', NOW, t)).toBe('3 mois');
  });

  it('renvoie "1 an" pile à 12 mois', () => {
    // Ajuste pour garantir exactement 12 mois (sans débordement)
    const exactly12Months = NOW - 12 * 30.44 * 24 * 3600 * 1000;
    const opening = new Date(exactly12Months).toISOString().slice(0, 10);
    expect(formatDuration(opening, NOW, t)).toBe('1 an');
  });

  it('renvoie "N ans" pluralisé pour exactement N (>1) ans', () => {
    // 24 mois × 30.44 jours = 730.56 jours → opening exactement à 24 mois
    const exactly24Months = NOW - 24 * 30.44 * 24 * 3600 * 1000;
    const opening = new Date(exactly24Months).toISOString().slice(0, 10);
    expect(formatDuration(opening, NOW, t)).toBe('2 ans');
  });

  it('renvoie "1 an N mois" pour entre 1 an et 2 ans non-pile', () => {
    expect(formatDuration('2025-01-31', NOW, t)).toBe('1 an 3 mois');
  });

  it('renvoie "N ans N mois" pluralisé pour 2 ans + N mois', () => {
    expect(formatDuration('2024-01-31', NOW, t)).toBe('2 ans 3 mois');
  });
});
