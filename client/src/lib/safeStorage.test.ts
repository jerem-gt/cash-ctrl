import { describe, expect, it, vi } from 'vitest';

import { safeStorage } from './safeStorage';

describe('safeStorage', () => {
  it('lit, écrit et supprime normalement', () => {
    safeStorage.setItem('k', 'v');
    expect(safeStorage.getItem('k')).toBe('v');
    safeStorage.removeItem('k');
    expect(safeStorage.getItem('k')).toBeNull();
  });

  it('renvoie null et ignore les erreurs quand localStorage lève', () => {
    const boom = () => {
      throw new Error('blocked');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom);
    expect(safeStorage.getItem('k')).toBeNull();
    expect(() => safeStorage.setItem('k', 'v')).not.toThrow();
    expect(() => safeStorage.removeItem('k')).not.toThrow();
  });
});
