// Mémorise le dernier élément focalisé : un clic peut faire perdre le focus (activeElement = body) avant l'ouverture d'une modale.
let lastFocused: HTMLElement | null = null;

if (typeof document !== 'undefined') {
  document.addEventListener(
    'focusin',
    (e) => {
      if (e.target instanceof HTMLElement) lastFocused = e.target;
    },
    true,
  );
}

export function getFocusReturnTarget(): HTMLElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) return active;
  return lastFocused?.isConnected ? lastFocused : null;
}
