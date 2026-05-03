import { useSyncExternalStore } from 'react';

export type GroupBy = 'bank' | 'type';

const KEY = 'cashctrl.accountsGroupBy';

let current: GroupBy = (localStorage.getItem(KEY) as GroupBy) ?? 'bank';
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
  localStorage.setItem(KEY, g);
  for (const cb of listeners) cb();
}

export function useAccountsGroupBy() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
