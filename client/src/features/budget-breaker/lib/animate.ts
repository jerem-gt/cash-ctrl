export const FALL_MS = 900;

export function prefersReducedMotion(): boolean {
  return (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// Anime l'élément réel de la page ; null quand l'API Web Animations est absente (jsdom).
export function animateBrick(
  el: HTMLElement,
  reduced: boolean,
  random: () => number = Math.random,
): Animation | null {
  if (typeof el.animate !== 'function') return null;
  if (reduced) {
    return el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
  }
  const dir = random() < 0.5 ? -1 : 1;
  const rotation = dir * (25 + random() * 35);
  return el.animate(
    [
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1, offset: 0 },
      { transform: 'translate(-3px, 1px) rotate(-1.5deg)', opacity: 1, offset: 0.06 },
      { transform: 'translate(3px, -1px) rotate(1.5deg)', opacity: 1, offset: 0.12 },
      { transform: 'translate(-2px, 0) rotate(-1deg)', opacity: 1, offset: 0.18 },
      { transform: `translateY(110vh) rotate(${rotation}deg)`, opacity: 0, offset: 1 },
    ],
    { duration: FALL_MS, easing: 'ease-in', fill: 'forwards' },
  );
}
