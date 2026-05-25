import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import accountsFr from './locales/fr/accounts.json';
import commonFr from './locales/fr/common.json';

void i18n.use(initReactI18next).init({
  lng: 'fr',
  fallbackLng: 'fr',
  defaultNS: 'common',
  resources: {
    fr: {
      common: commonFr,
      accounts: accountsFr,
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
