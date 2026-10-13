import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query, QueryClient } from '@tanstack/react-query';
import { defaultShouldDehydrateQuery } from '@tanstack/react-query';
import { del, get, set } from 'idb-keyval';

import { fireAndForget } from '@/lib/async';
import { queryKeys } from '@/lib/queryKeys';
import { safeStorage } from '@/lib/safeStorage';

const hasIdb = typeof indexedDB !== 'undefined';
const OWNER_KEY = 'cashctrl.cacheOwner';

export const queryPersister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => (hasIdb ? get<string>(key) : Promise.resolve(null)),
    setItem: (key, value) => (hasIdb ? set(key, value) : Promise.resolve()),
    removeItem: (key) => (hasIdb ? del(key) : Promise.resolve()),
  },
  key: 'cashctrl-query-cache',
  throttleTime: 2000,
});

// La session (`me`) ne doit jamais être persistée
export function shouldPersistQuery(query: Query): boolean {
  return query.queryKey[0] !== queryKeys.me()[0] && defaultShouldDehydrateQuery(query);
}

// Purge le cache persisté sans bloquer si IndexedDB échoue
export function purgePersistedCache(): void {
  try {
    fireAndForget(Promise.resolve(queryPersister.removeClient()));
  } catch {
    // ignoré volontairement
  }
}

// Si le cache appartient à un autre utilisateur, le purge puis réassigne le propriétaire
export function claimCacheOwner(qc: QueryClient, username: string): void {
  const owner = safeStorage.getItem(OWNER_KEY);
  if (owner !== username) {
    qc.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.me()[0] });
    purgePersistedCache();
  }
  safeStorage.setItem(OWNER_KEY, username);
}
