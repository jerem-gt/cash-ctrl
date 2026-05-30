import { describe, expect, it } from 'vitest';

import { prefetchRouteChunk, routeChunk } from './routeChunks';

describe('routeChunk', () => {
  it('expose un loader pour chaque route lazy', () => {
    const expected = [
      '/',
      '/transactions',
      '/accounts',
      '/accounts/:id',
      '/scheduled',
      '/settings',
    ];
    const byName = (a: string, b: string) => a.localeCompare(b);
    expect(Object.keys(routeChunk).sort(byName)).toEqual([...expected].sort(byName));
    for (const loader of Object.values(routeChunk)) {
      expect(typeof loader).toBe('function');
    }
  });
});

describe('prefetchRouteChunk', () => {
  it('ne fait rien (sans lever) pour une route inconnue', () => {
    expect(() => prefetchRouteChunk('/route-inexistante')).not.toThrow();
  });

  it('déclenche le loader pour une route connue', () => {
    // On remplace temporairement le loader pour vérifier qu'il est invoqué sans
    // déclencher le vrai import dynamique de la page.
    const original = routeChunk['/transactions'];
    let called = false;
    (routeChunk as Record<string, () => Promise<unknown>>)['/transactions'] = () => {
      called = true;
      return Promise.resolve({ default: () => null });
    };
    try {
      prefetchRouteChunk('/transactions');
      expect(called).toBe(true);
    } finally {
      (routeChunk as Record<string, () => Promise<unknown>>)['/transactions'] = original;
    }
  });
});
