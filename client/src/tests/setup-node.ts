import i18n from '../i18n';

// Pin language to French so the host system locale (often en on CI) doesn't flip
// Intl.* outputs in pure-Node lib tests that depend on currentLocale().
void i18n.changeLanguage('fr');
