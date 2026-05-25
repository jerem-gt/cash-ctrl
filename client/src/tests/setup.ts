import '@testing-library/jest-dom/vitest';
import '../i18n';

import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './msw/server';

// jsdom doesn't implement scrollTo
window.scrollTo = () => undefined;

// recharts ResponsiveContainer uses ResizeObserver — stub for jsdom
globalThis.ResizeObserver = class {
  observe() {
    /* no-op stub */
  }
  unobserve() {
    /* no-op stub */
  }
  disconnect() {
    /* no-op stub */
  }
} as unknown as typeof ResizeObserver;

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
