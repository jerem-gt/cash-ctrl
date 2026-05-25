import 'i18next';

import type accountsFr from './locales/fr/accounts.json';
import type commonFr from './locales/fr/common.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof commonFr;
      accounts: typeof accountsFr;
    };
  }
}
