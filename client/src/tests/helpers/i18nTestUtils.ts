/** Namespaces chargés à la demande (non inclus dans ns: [...] de i18n.ts). */
export const LAZY_NAMESPACES = [
  'accounts',
  'admin',
  'dashboard',
  'insurance',
  'loans',
  'portfolio',
  'reports',
  'scheduled',
  'settings',
  'transactions',
] as const;

/**
 * À appeler dans un beforeAll APRÈS vi.resetModules() + import dynamique du SUT.
 * Attend que la nouvelle instance i18n soit initialisée et charge tous les namespaces
 * en français afin que useTranslation() ne suspende pas pendant les tests.
 */
export async function loadI18nForTests(): Promise<void> {
  const { default: i18n, initPromise } = await import('@/i18n');
  await initPromise;
  await i18n.changeLanguage('fr');
  await i18n.loadNamespaces([...LAZY_NAMESPACES]);
}
