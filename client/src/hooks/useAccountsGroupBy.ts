import { useSyncExternalStore } from 'react';

import { safeStorage } from '@/lib/safeStorage';

export type GroupBy = 'bank' | 'type';

const KEY = 'cashctrl.accountsGroupBy';

let current: GroupBy = (safeStorage.getItem(KEY) as GroupBy) ?? 'bank';
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): GroupBy {
  return current;
}

export function setGroupBy(g: GroupBy) {
  current = g;
  safeStorage.setItem(KEY, g);
  for (const cb of listeners) cb();
}

export function useAccountsGroupBy() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
