import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { TAX_YEAR_DATA_2026, TAX_YEARS } from '@/tests/fixtures';

import { useTaxYearData, useTaxYears } from './useTax';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('useTaxYears', () => {
  it('charge la liste des années disponibles', async () => {
    const { result } = renderHook(() => useTaxYears(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(TAX_YEARS);
  });
});

describe('useTaxYearData', () => {
  it('charge les données fiscales pour une année valide', async () => {
    const { result } = renderHook(() => useTaxYearData(2026), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(TAX_YEAR_DATA_2026);
  });

  it('ne déclenche pas de requête quand year est undefined', () => {
    const { result } = renderHook(() => useTaxYearData(undefined), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
  });
});
