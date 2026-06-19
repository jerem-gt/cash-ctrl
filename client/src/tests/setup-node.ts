import { beforeAll } from 'vitest';

import i18n, { initPromise } from '../i18n';
import { LAZY_NAMESPACES } from './helpers/i18nTestUtils';

// Pin language to French so the host system locale (often en on CI) doesn't flip
// Intl.* outputs in pure-Node lib tests that depend on currentLocale().
beforeAll(async () => {
  await initPromise;
  await i18n.changeLanguage('fr');
  await i18n.loadNamespaces([...LAZY_NAMESPACES]);
});
