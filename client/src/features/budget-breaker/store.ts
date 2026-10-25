import { useSyncExternalStore } from 'react';

export interface BudgetBreakerState {
  active: boolean;
  remainingRatio: number;
}

let current: BudgetBreakerState = { active: false, remainingRatio: 1 };
const listeners = new Set<() => void>();

function publish(next: BudgetBreakerState) {
  current = next;
  for (const cb of listeners) cb();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): BudgetBreakerState {
  return current;
}

export function startBudgetBreaker() {
  publish({ active: true, remainingRatio: 1 });
}

export function stopBudgetBreaker() {
  publish({ active: false, remainingRatio: 1 });
}

export function setRemainingRatio(ratio: number) {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  if (clamped === current.remainingRatio) return;
  publish({ ...current, remainingRatio: clamped });
}

export function useBudgetBreaker(): BudgetBreakerState {
  return useSyncExternalStore(subscribe, getSnapshot);
}
