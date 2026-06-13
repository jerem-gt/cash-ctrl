import type { ComponentType } from 'react';

type LazyComponentModule = { default: ComponentType };

// Source unique des imports dynamiques des pages. Utilisée à la fois par App
// (lazy-loading des routes) et par le préchargement au survol (via prefetch.ts),
// pour que le warming d'un chunk au hover réutilise exactement le chunk chargé
// ensuite au clic (Vite déduplique par spécificateur de module).
export const routeChunk = {
  '/': () => import('@/pages/DashboardPage'),
  '/transactions': () => import('@/pages/TransactionsPage'),
  '/accounts': () => import('@/pages/AccountsPage'),
  '/accounts/:id': () => import('@/pages/AccountDetailPage'),
  '/scheduled': () => import('@/pages/ScheduledPage'),
  '/settings': () => import('@/pages/SettingsPage'),
  '/reports': () => import('@/pages/ReportsPage'),
} satisfies Record<string, () => Promise<LazyComponentModule>>;

export type RouteChunkKey = keyof typeof routeChunk;

// Déclenche le téléchargement du chunk JS d'une route sans attendre le clic.
// Les erreurs sont avalées : un prefetch raté n'a pas d'incidence, la navigation
// réelle relancera l'import (avec le rechargement de page géré dans App).
export function prefetchRouteChunk(route: string): void {
  const loader = (routeChunk as Record<string, (() => Promise<unknown>) | undefined>)[route];
  if (loader) void loader().catch(() => {});
}
