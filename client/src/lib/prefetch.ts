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
import { prefetchRouteChunk } from '@/lib/routeChunks';

export function prefetchForRoute(qc: QueryClient, route: string): void {
  // Précharge le chunk JS de la route en plus de ses données : sans ça, le
  // survol ne réchauffe que le cache React Query et le clic déclenche encore
  // le téléchargement du bundle de page.
  prefetchRouteChunk(route);

  const p = (key: unknown[], fn: () => Promise<unknown>) =>
    qc.prefetchQuery({ queryKey: key, queryFn: fn });

  const accounts = () => p(['accounts'], accountsApi.list);
  const banks = () => p(['banks'], banksApi.list);
  const cats = () => p(['categories'], categoriesApi.list);
  const pms = () => p(['payment-methods'], paymentMethodsApi.list);
  const ats = () => p(['account-types'], accountTypesApi.list);

  switch (route) {
    case '/':
      void accounts();
      void banks();
      void cats();
      void p(['transactions', { limit: 10000 }], () => transactionsApi.list({ limit: 10000 }));
      break;
    case '/transactions':
      void accounts();
      void banks();
      void cats();
      void pms();
      void p(['transactions', { page: 1, limit: 25 }], () =>
        transactionsApi.list({ page: 1, limit: 25 }),
      );
      break;
    case '/scheduled':
      void accounts();
      void cats();
      void pms();
      void p(['scheduled'], scheduledApi.list);
      break;
    case '/accounts':
      void accounts();
      void banks();
      void ats();
      break;
    case '/settings':
      void cats();
      void ats();
      void banks();
      void pms();
      void p(['settings'], settingsApi.get);
      break;
  }
}

export function prefetchAccountDetail(qc: QueryClient, accountId: number): void {
  prefetchRouteChunk('/accounts/:id');
  void qc.prefetchQuery({
    queryKey: ['transactions', { account_id: accountId, page: 1, limit: 25 }],
    queryFn: () => transactionsApi.list({ account_id: accountId, page: 1, limit: 25 }),
  });
}
