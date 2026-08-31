import type { QueryClient } from '@tanstack/react-query';

import {
  accountsApi,
  accountTypesApi,
  banksApi,
  categoriesApi,
  paymentMethodsApi,
  scheduledApi,
  settingsApi,
  transactionsApi,
} from '@/api/client';
import { fireAndForget } from '@/lib/async';
import { prefetchRouteChunk } from '@/lib/routeChunks';

export function prefetchForRoute(qc: QueryClient, route: string): void {
  // Précharge le chunk JS de la route en plus de ses données : sans ça, le
  // survol ne réchauffe que le cache React Query et le clic déclenche encore
  // le téléchargement du bundle de page.
  prefetchRouteChunk(route);

  const p = (key: unknown[], fn: () => Promise<unknown>) =>
    qc.query({ queryKey: key, queryFn: fn });

  const accounts = () => p(['accounts'], accountsApi.list);
  const banks = () => p(['banks'], banksApi.list);
  const cats = () => p(['categories'], categoriesApi.list);
  const pms = () => p(['payment-methods'], paymentMethodsApi.list);
  const ats = () => p(['account-types'], accountTypesApi.list);

  switch (route) {
    case '/':
      // Le Dashboard tire ses transactions (récentes, à valider, à venir) de
      // l'endpoint dashboard-stats : pas besoin de précharger la liste complète.
      fireAndForget(accounts());
      fireAndForget(banks());
      fireAndForget(cats());
      break;
    case '/transactions':
      fireAndForget(accounts());
      fireAndForget(banks());
      fireAndForget(cats());
      fireAndForget(pms());
      fireAndForget(
        p(['transactions', { page: 1, limit: 25 }], () =>
          transactionsApi.list({ page: 1, limit: 25 }),
        ),
      );
      break;
    case '/scheduled':
      fireAndForget(accounts());
      fireAndForget(cats());
      fireAndForget(pms());
      fireAndForget(p(['scheduled'], scheduledApi.list));
      break;
    case '/accounts':
      fireAndForget(accounts());
      fireAndForget(banks());
      fireAndForget(ats());
      break;
    case '/settings':
      fireAndForget(cats());
      fireAndForget(ats());
      fireAndForget(banks());
      fireAndForget(pms());
      fireAndForget(p(['settings'], settingsApi.get));
      break;
  }
}

export function prefetchAccountDetail(qc: QueryClient, accountId: number): void {
  prefetchRouteChunk('/accounts/:id');
  fireAndForget(
    qc.query({
      queryKey: ['transactions', { account_id: accountId, page: 1, limit: 25 }],
      queryFn: () => transactionsApi.list({ account_id: accountId, page: 1, limit: 25 }),
    }),
  );
}
