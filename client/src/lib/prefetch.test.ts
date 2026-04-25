import { describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '@/tests/helpers/renderWithProviders';

import { prefetchAccountDetail, prefetchForRoute } from './prefetch';

function makeQc() {
  const qc = createTestQueryClient();
  const spy = vi.spyOn(qc, 'prefetchQuery').mockResolvedValue(undefined);
  return { qc, spy };
}

describe('prefetchForRoute', () => {
  it('précharge accounts, banks, categories et transactions pour "/"', () => {
    const { qc, spy } = makeQc();
    prefetchForRoute(qc, '/');
    const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
    expect(keys).toContainEqual(['accounts']);
    expect(keys).toContainEqual(['banks']);
    expect(keys).toContainEqual(['categories']);
    expect(keys.some((k) => Array.isArray(k) && k[0] === 'transactions')).toBe(true);
  });

  it('précharge accounts, banks, categories, payment-methods et transactions pour "/transactions"', () => {
    const { qc, spy } = makeQc();
    prefetchForRoute(qc, '/transactions');
    const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
    expect(keys).toContainEqual(['accounts']);
    expect(keys).toContainEqual(['banks']);
    expect(keys).toContainEqual(['categories']);
    expect(keys).toContainEqual(['payment-methods']);
    expect(keys.some((k) => Array.isArray(k) && k[0] === 'transactions')).toBe(true);
  });

  it('précharge accounts, categories, payment-methods et scheduled pour "/scheduled"', () => {
    const { qc, spy } = makeQc();
    prefetchForRoute(qc, '/scheduled');
    const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
    expect(keys).toContainEqual(['accounts']);
    expect(keys).toContainEqual(['categories']);
    expect(keys).toContainEqual(['payment-methods']);
    expect(keys).toContainEqual(['scheduled']);
  });

  it('précharge accounts, banks et account-types pour "/accounts"', () => {
    const { qc, spy } = makeQc();
    prefetchForRoute(qc, '/accounts');
    const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
    expect(keys).toContainEqual(['accounts']);
    expect(keys).toContainEqual(['banks']);
    expect(keys).toContainEqual(['account-types']);
  });

  it('précharge categories, account-types, banks, payment-methods et settings pour "/settings"', () => {
    const { qc, spy } = makeQc();
    prefetchForRoute(qc, '/settings');
    const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
    expect(keys).toContainEqual(['categories']);
    expect(keys).toContainEqual(['account-types']);
    expect(keys).toContainEqual(['banks']);
    expect(keys).toContainEqual(['payment-methods']);
    expect(keys).toContainEqual(['settings']);
  });

  it('ne précharge rien pour une route inconnue', () => {
    const { qc, spy } = makeQc();
    prefetchForRoute(qc, '/unknown');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('prefetchAccountDetail', () => {
  it('précharge les transactions filtrées par account_id', () => {
    const { qc, spy } = makeQc();
    prefetchAccountDetail(qc, 42);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['transactions', { account_id: 42, page: 1, limit: 25 }],
      }),
    );
  });
});
