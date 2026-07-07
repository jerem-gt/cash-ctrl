/** Détecte macOS pour afficher le bon raccourci (⌘K vs Ctrl K). */
export function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/.test(navigator.userAgent);
}
