// Anti-FOUC : applique le thème avant le premier paint. Fichier séparé (et non script
// inline) : la CSP par défaut de helmet (`script-src 'self'`) bloque les scripts inline.
// En dev la CSS arrive via JS (non render-blocking), donc on pose aussi le background-color
// sur <html> — les valeurs doivent rester en sync avec --c-canvas dans index.css ;
// useTheme le retire au chargement.
(function () {
  const root = globalThis.document.documentElement;
  try {
    const stored = globalThis.localStorage.getItem('cashctrl.theme');
    const dark =
      stored === 'dark' ||
      (stored !== 'light' && globalThis.matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', dark);
    root.style.backgroundColor = dark ? '#0c1a21' : '#eaeef2';
  } catch {
    // localStorage indisponible ou bloqué : repli explicite en mode clair.
    root.classList.remove('dark');
  }
})();
