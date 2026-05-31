import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import i18n from '../i18n';
import { server } from './msw/server';

// Pin language to French so jsdom's navigator (en-US) doesn't flip the locale in tests
void i18n.changeLanguage('fr');

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
};

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
