import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import accountsEn from './locales/en/accounts.json';
import adminEn from './locales/en/admin.json';
import commonEn from './locales/en/common.json';
import dashboardEn from './locales/en/dashboard.json';
import errorsEn from './locales/en/errors.json';
import insuranceEn from './locales/en/insurance.json';
import loansEn from './locales/en/loans.json';
import portfolioEn from './locales/en/portfolio.json';
import reportsEn from './locales/en/reports.json';
import scheduledEn from './locales/en/scheduled.json';
import settingsEn from './locales/en/settings.json';
import sidebarEn from './locales/en/sidebar.json';
import transactionsEn from './locales/en/transactions.json';
import accountsFr from './locales/fr/accounts.json';
import adminFr from './locales/fr/admin.json';
import commonFr from './locales/fr/common.json';
import dashboardFr from './locales/fr/dashboard.json';
import errorsFr from './locales/fr/errors.json';
import insuranceFr from './locales/fr/insurance.json';
import loansFr from './locales/fr/loans.json';
import portfolioFr from './locales/fr/portfolio.json';
import reportsFr from './locales/fr/reports.json';
import scheduledFr from './locales/fr/scheduled.json';
import settingsFr from './locales/fr/settings.json';
import sidebarFr from './locales/fr/sidebar.json';
import transactionsFr from './locales/fr/transactions.json';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'fr',
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    resources: {
      fr: {
        common: commonFr,
        accounts: accountsFr,
        admin: adminFr,
        transactions: transactionsFr,
        settings: settingsFr,
        loans: loansFr,
        insurance: insuranceFr,
        portfolio: portfolioFr,
        dashboard: dashboardFr,
        sidebar: sidebarFr,
        scheduled: scheduledFr,
        reports: reportsFr,
        errors: errorsFr,
      },
      en: {
        common: commonEn,
        accounts: accountsEn,
        admin: adminEn,
        transactions: transactionsEn,
        settings: settingsEn,
        loans: loansEn,
        insurance: insuranceEn,
        portfolio: portfolioEn,
        dashboard: dashboardEn,
        sidebar: sidebarEn,
        scheduled: scheduledEn,
        reports: reportsEn,
        errors: errorsEn,
      },
    },
    interpolation: {
      escapeValue: false,
    },
  });

export { default } from 'i18next';
