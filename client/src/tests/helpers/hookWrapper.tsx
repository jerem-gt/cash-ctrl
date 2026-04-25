import { QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import { createTestQueryClient } from './renderWithProviders';

export function createHookWrapper() {
  const qc = createTestQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  }
  return { qc, Wrapper };
}
