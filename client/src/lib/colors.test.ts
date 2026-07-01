import { generateColor } from '@/lib/colors.ts';

describe('generateColor', () => {
  const basePalette = [
    '#3b82f6',
    '#ef4444',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
  ];

  test('doit retourner les couleurs de la basePalette pour les premiers index', () => {
    basePalette.forEach((hex, i) => {
      expect(generateColor(i)).toBe(hex);
    });
  });

  test('doit générer une couleur HSL pour les index au-delà de la palette', () => {
    const result = generateColor(basePalette.length);
    // Vérifie que le format commence par hsl(
    expect(result).toMatch(/^hsl\(\d+(\.\d+)?, \d+(\.\d+)?%, \d+(\.\d+)?%\)$/);
  });

  test('doit être déterministe (même index = même couleur)', () => {
    const color1 = generateColor(15);
    const color2 = generateColor(15);
    expect(color1).toBe(color2);
  });

  test('doit produire des couleurs différentes pour des index différents', () => {
    const color1 = generateColor(10);
    const color2 = generateColor(11);
    expect(color1).not.toBe(color2);
  });

  test('les valeurs HSL doivent rester dans les bornes valides', () => {
    // Test sur un large échantillon pour vérifier les calculs de saturation/lightness
    for (let i = 8; i < 100; i++) {
      const color = generateColor(i);
      const matches = /hsl\((.*)\)/.exec(color)?.[1].split(', ');

      if (matches) {
        const h = Number.parseFloat(matches[0]);
        const s = Number.parseFloat(matches[1]);
        const l = Number.parseFloat(matches[2]);

        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(360);
        expect(s).toBeGreaterThanOrEqual(65);
        expect(s).toBeLessThanOrEqual(90);
        expect(l).toBeGreaterThanOrEqual(40);
        expect(l).toBeLessThanOrEqual(60);
      }
    }
  });
});
