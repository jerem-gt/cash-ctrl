// Pile d'Échap : seule l'entrée la plus haute (dernier ouverte) réagit.
interface EscapeEntry {
  onEscape: () => void;
  // Rang d'ouverture (fixé au premier rendu) : indépendant de l'ordre de rejeu des effets (StrictMode).
  order: number;
}

let orderCounter = 0;
export function nextEscapeOrder(): number {
  orderCounter += 1;
  return orderCounter;
}

const stack: EscapeEntry[] = [];

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  let top: EscapeEntry | undefined;
  for (const entry of stack) {
    if (top === undefined || entry.order > top.order) top = entry;
  }
  top?.onEscape();
}

export function pushEscape(entry: EscapeEntry): () => void {
  if (stack.length === 0) globalThis.addEventListener('keydown', onKeyDown);
  stack.push(entry);
  return () => {
    const i = stack.indexOf(entry);
    if (i !== -1) stack.splice(i, 1);
    if (stack.length === 0) globalThis.removeEventListener('keydown', onKeyDown);
  };
}

// Compteur global de verrous de scroll, restauré quand la dernière modale se ferme.
let scrollLocks = 0;
let previousOverflow = '';

export function lockBodyScroll(): () => void {
  if (scrollLocks === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLocks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLocks -= 1;
    if (scrollLocks === 0) document.body.style.overflow = previousOverflow;
  };
}
