import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi } from 'vitest';

import { createTestQueryClient } from './renderWithProviders';

export function createHookWrapper() {
  const qc = createTestQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  }
  return { qc, Wrapper };
}

// Espionne qc.invalidateQueries et expose les clés invalidées jusque-là.
export function spyInvalidations(qc: QueryClient) {
  const spy = vi.spyOn(qc, 'invalidateQueries');
  return () => spy.mock.calls.map(([filters]) => filters?.queryKey);
}
