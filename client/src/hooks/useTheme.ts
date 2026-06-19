import { useSyncExternalStore } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const KEY = 'cashctrl.theme';

function readStored(): ThemeMode {
  const v = localStorage.getItem(KEY);
  if (v === 'light' || v === 'dark') return v;
  return 'system';
}

let current: ThemeMode = readStored();
const listeners = new Set<() => void>();

const media =
  typeof globalThis !== 'undefined' && typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia('(prefers-color-scheme: dark)')
    : null;

/** Calcule l'état sombre effectif pour un mode donné. */
function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'system') return media?.matches ?? false;
  return mode === 'dark';
}

/** Applique (ou retire) la classe `.dark` sur <html> selon le mode courant. */
function applyTheme() {
  document.documentElement.classList.toggle('dark', resolveDark(current));
}

// Sync DOM to stored preference on module load (reinforces the anti-FOUC inline script).
applyTheme();

// En mode système, suivre les changements de préférence de l'OS en direct.
media?.addEventListener('change', () => {
  if (current === 'system') {
    applyTheme();
    for (const cb of listeners) cb();
  }
});

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): ThemeMode {
  return current;
}

export function setTheme(mode: ThemeMode) {
  current = mode;
  if (mode === 'system') {
    localStorage.removeItem(KEY);
  } else {
    localStorage.setItem(KEY, mode);
  }
  applyTheme();
  for (const cb of listeners) cb();
}

/** Mode choisi par l'utilisateur (`light` | `dark` | `system`). */
export function useTheme(): ThemeMode {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** `true` si le thème sombre est effectivement actif (utile pour la data viz). */
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, () => resolveDark(current));
}
