import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FailureRateLimiter } from './rateLimit';

describe('FailureRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('autorise tant que le seuil n est pas atteint', () => {
    const limiter = new FailureRateLimiter(3, 1000);
    expect(limiter.isAllowed('ip')).toBe(true);
    limiter.recordFailure('ip');
    limiter.recordFailure('ip');
    expect(limiter.isAllowed('ip')).toBe(true);
  });

  it('bloque une fois le seuil atteint', () => {
    const limiter = new FailureRateLimiter(3, 1000);
    limiter.recordFailure('ip');
    limiter.recordFailure('ip');
    limiter.recordFailure('ip');
    expect(limiter.isAllowed('ip')).toBe(false);
  });

  it('réautorise après expiration de la fenêtre', () => {
    const limiter = new FailureRateLimiter(2, 1000);
    limiter.recordFailure('ip');
    limiter.recordFailure('ip');
    expect(limiter.isAllowed('ip')).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(limiter.isAllowed('ip')).toBe(true);
  });

  it('reset remet le compteur à zéro', () => {
    const limiter = new FailureRateLimiter(2, 1000);
    limiter.recordFailure('ip');
    limiter.recordFailure('ip');
    expect(limiter.isAllowed('ip')).toBe(false);
    limiter.reset('ip');
    expect(limiter.isAllowed('ip')).toBe(true);
  });

  it('isole les clés entre elles', () => {
    const limiter = new FailureRateLimiter(1, 1000);
    limiter.recordFailure('ip-a');
    expect(limiter.isAllowed('ip-a')).toBe(false);
    expect(limiter.isAllowed('ip-b')).toBe(true);
  });
});
