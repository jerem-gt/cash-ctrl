import { describe, expect, it } from 'vitest';

import { calculateTotalAmount } from '@/lib/stock.ts'; // ou depuis 'bun:test'

describe('calculateTotalAmount()', () => {
  it('ajoute les frais au montant brut lors d’un achat', () => {
    // 10 * 100 + 5 = 1005
    const result = calculateTotalAmount('buy', 10, 100, 5);
    expect(result).toBe(1005);
  });

  it('soustrait les frais du montant brut lors d’une vente', () => {
    // 10 * 100 - 5 = 995
    const result = calculateTotalAmount('sell', 10, 100, 5);
    expect(result).toBe(995);
  });

  it('retourne 0 si la quantité ou le prix est nul ou négatif', () => {
    expect(calculateTotalAmount('buy', 0, 100, 5)).toBe(0);
    expect(calculateTotalAmount('buy', 10, 0, 5)).toBe(0);
    expect(calculateTotalAmount('buy', -1, 100, 5)).toBe(0);
  });

  it('ignore les frais si ces derniers sont à 0', () => {
    expect(calculateTotalAmount('buy', 10, 100, 0)).toBe(1000);
    expect(calculateTotalAmount('sell', 10, 100, 0)).toBe(1000);
  });

  it('gère correctement les grands nombres décimaux (précision)', () => {
    // 0.1 * 0.2 avec des frais de 0.05
    // En finance, on utilise souvent toBeCloseTo pour éviter les erreurs d'arrondi JS
    const result = calculateTotalAmount('buy', 0.1, 0.2, 0.05);
    expect(result).toBeCloseTo(0.07);
  });

  it(`considère tout mode autre que "buy" comme une vente`, () => {
    // Comportement actuel de ta fonction
    expect(calculateTotalAmount('anything', 10, 100, 5)).toBe(995);
  });
});
