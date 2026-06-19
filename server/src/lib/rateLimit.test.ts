import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initSchema } from '../db/schema';
import { FailureRateLimiter } from './rateLimit';

function createLimiter(maxAttempts = 3, windowMs = 1000) {
  const db = new Database(':memory:');
  initSchema(db);
  return new FailureRateLimiter(db, maxAttempts, windowMs);
}

describe('FailureRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('autorise tant que le seuil n est pas atteint', () => {
    const limiter = createLimiter();
    expect(limiter.isAllowed('ip')).toBe(true);
    limiter.recordFailure('ip');
    limiter.recordFailure('ip');
    expect(limiter.isAllowed('ip')).toBe(true);
  });

  it('bloque une fois le seuil atteint', () => {
    const limiter = createLimiter();
    limiter.recordFailure('ip');
    limiter.recordFailure('ip');
    limiter.recordFailure('ip');
    expect(limiter.isAllowed('ip')).toBe(false);
  });

  it('réautorise après expiration de la fenêtre', () => {
    const limiter = createLimiter(2);
    limiter.recordFailure('ip');
    limiter.recordFailure('ip');
    expect(limiter.isAllowed('ip')).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(limiter.isAllowed('ip')).toBe(true);
  });

  it('reset remet le compteur à zéro', () => {
    const limiter = createLimiter(2);
    limiter.recordFailure('ip');
    limiter.recordFailure('ip');
    expect(limiter.isAllowed('ip')).toBe(false);
    limiter.reset('ip');
    expect(limiter.isAllowed('ip')).toBe(true);
  });

  it('isole les clés entre elles', () => {
    const limiter = createLimiter(1);
    limiter.recordFailure('ip-a');
    expect(limiter.isAllowed('ip-a')).toBe(false);
    expect(limiter.isAllowed('ip-b')).toBe(true);
  });

  it('survit à un redémarrage (compteurs persistés)', () => {
    const db = new Database(':memory:');
    initSchema(db);
    const limiter = new FailureRateLimiter(db, 3, 1000);
    limiter.recordFailure('ip');
    limiter.recordFailure('ip');
    limiter.recordFailure('ip');

    const limiter2 = new FailureRateLimiter(db, 3, 1000);
    expect(limiter2.isAllowed('ip')).toBe(false);
  });

  it('reset efface le compteur pour toute instance partageant la même DB', () => {
    const db = new Database(':memory:');
    initSchema(db);
    const limiter = new FailureRateLimiter(db, 3, 1000);
    limiter.recordFailure('ip');
    limiter.recordFailure('ip');
    limiter.recordFailure('ip');

    const limiter2 = new FailureRateLimiter(db, 3, 1000);
    expect(limiter2.isAllowed('ip')).toBe(false);
    limiter2.reset('ip');

    const limiter3 = new FailureRateLimiter(db, 3, 1000);
    expect(limiter3.isAllowed('ip')).toBe(true);
  });
});
