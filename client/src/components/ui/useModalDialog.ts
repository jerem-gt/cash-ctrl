import { type RefObject, useEffect, useRef, useState } from 'react';

import { lockBodyScroll, nextEscapeOrder, pushEscape } from './escapeStack';
import { getFocusReturnTarget } from './focusTracker';

const FOCUSABLE_SELECTOR =
  'input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

// Ouvre le <dialog> en modal (top layer), verrouille le scroll, gère Échap via la pile et restaure le focus.
export function useModalDialog(
  onClose?: () => void,
  options?: { initialFocusRef?: RefObject<HTMLElement | null> },
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const initialFocusRef = options?.initialFocusRef;
  const onCloseRef = useRef(onClose);
  // Capturé au premier rendu, avant les effets des enfants qui peuvent prendre le focus.
  const [previouslyFocused] = useState(getFocusReturnTarget);
  const [order] = useState(nextEscapeOrder);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Repli sur l'attribut `open` si showModal est absent (jsdom).
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    // Cible explicite prioritaire : showModal() peut avoir focalisé un autre élément du dialog.
    const requested = initialFocusRef?.current;
    if (requested) {
      requested.focus();
    } else if (!dialog.contains(document.activeElement)) {
      const target =
        [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].find(
          (el) => el.tabIndex >= 0,
        ) ?? dialog;
      target.focus();
    }
    const unlockScroll = lockBodyScroll();
    // Toujours dans la pile : sans onClose, la modale bloque quand même les modales du dessous.
    const release = pushEscape({ onEscape: () => onCloseRef.current?.(), order });
    return () => {
      release();
      unlockScroll();
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [previouslyFocused, initialFocusRef, order]);

  return dialogRef;
}
