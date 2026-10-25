import { safeStorage } from '@/lib/safeStorage';

export const BEST_KEY = 'cashctrl.budgetBreaker.best';
// Durée de jeu effectif minimale pour qu'une partie compte pour le record.
export const MIN_RECORD_PLAY_SECONDS = 15;

export function readBest(): number {
  const raw = safeStorage.getItem(BEST_KEY);
  if (raw === null) return 0;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export interface RunOutcome {
  newRecord: boolean;
  best: number;
}

export function settleRun(damage: number, playSeconds: number): RunOutcome {
  const best = readBest();
  if (playSeconds >= MIN_RECORD_PLAY_SECONDS && damage > best) {
    safeStorage.setItem(BEST_KEY, String(damage));
    return { newRecord: true, best: damage };
  }
  return { newRecord: false, best };
}
