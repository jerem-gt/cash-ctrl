import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import accountsFr from './locales/fr/accounts.json';
import commonFr from './locales/fr/common.json';
import dashboardFr from './locales/fr/dashboard.json';
import insuranceFr from './locales/fr/insurance.json';
import loansFr from './locales/fr/loans.json';
import portfolioFr from './locales/fr/portfolio.json';
import scheduledFr from './locales/fr/scheduled.json';
import settingsFr from './locales/fr/settings.json';
import sidebarFr from './locales/fr/sidebar.json';
import transactionsFr from './locales/fr/transactions.json';

void i18n.use(initReactI18next).init({
  lng: 'fr',
  fallbackLng: 'fr',
  defaultNS: 'common',
  resources: {
    fr: {
      common: commonFr,
      accounts: accountsFr,
      transactions: transactionsFr,
      settings: settingsFr,
      loans: loansFr,
      insurance: insuranceFr,
      portfolio: portfolioFr,
      dashboard: dashboardFr,
      sidebar: sidebarFr,
      scheduled: scheduledFr,
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
