import 'i18next';

import type accountsFr from './locales/fr/accounts.json';
import type adminFr from './locales/fr/admin.json';
import type commonFr from './locales/fr/common.json';
import type dashboardFr from './locales/fr/dashboard.json';
import type insuranceFr from './locales/fr/insurance.json';
import type loansFr from './locales/fr/loans.json';
import type portfolioFr from './locales/fr/portfolio.json';
import type scheduledFr from './locales/fr/scheduled.json';
import type settingsFr from './locales/fr/settings.json';
import type sidebarFr from './locales/fr/sidebar.json';
import type transactionsFr from './locales/fr/transactions.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof commonFr;
      accounts: typeof accountsFr;
      admin: typeof adminFr;
      transactions: typeof transactionsFr;
      settings: typeof settingsFr;
      loans: typeof loansFr;
      insurance: typeof insuranceFr;
      portfolio: typeof portfolioFr;
      dashboard: typeof dashboardFr;
      sidebar: typeof sidebarFr;
      scheduled: typeof scheduledFr;
    };
  }
}
