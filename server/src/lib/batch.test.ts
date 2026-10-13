import { describe, expect, it } from 'vitest';

import { mapInBatches } from './batch.js';

describe('mapInBatches', () => {
  it('traite tous les items avec une concurrence born�e', async () => {
    let running = 0;
    let max = 0;
    const done: number[] = [];
    await mapInBatches([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running++;
      max = Math.max(max, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      done.push(n);
    });
    expect(done.toSorted((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(max).toBe(3);
  });

  it('ne fait rien sur une liste vide', async () => {
    await expect(mapInBatches([], 5, () => Promise.resolve())).resolves.toBeUndefined();
  });
});
