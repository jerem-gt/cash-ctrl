import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import i18n, { initPromise } from '../i18n';
import { LAZY_NAMESPACES } from './helpers/i18nTestUtils';
import { server } from './msw/server';

// Évite les échecs aléatoires de waitFor/findBy* sous charge
configure({ asyncUtilTimeout: 3000 });

// jsdom doesn't implement scrollTo / scrollIntoView
window.scrollTo = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

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
afterEach(async () => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
  if (vi.isFakeTimers()) vi.useRealTimers();
  localStorage.clear();
  if (i18n.language !== 'fr') await i18n.changeLanguage('fr');
});
afterAll(() => server.close());
