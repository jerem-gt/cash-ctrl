import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import i18n, { initPromise } from '../i18n';
import { LAZY_NAMESPACES } from './helpers/i18nTestUtils';
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
};

beforeAll(async () => {
  await initPromise;
  await i18n.changeLanguage('fr');
  await i18n.loadNamespaces([...LAZY_NAMESPACES]);
  server.listen({ onUnhandledRequest: 'warn' });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
