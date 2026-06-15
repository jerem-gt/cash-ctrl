import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';

const hasIdb = typeof indexedDB !== 'undefined';

export const queryPersister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => (hasIdb ? get<string>(key) : Promise.resolve(null)),
    setItem: (key, value) => (hasIdb ? set(key, value) : Promise.resolve()),
    removeItem: (key) => (hasIdb ? del(key) : Promise.resolve()),
  },
  key: 'cashctrl-query-cache',
  throttleTime: 2000,
});
