import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { nextEscapeOrder, pushEscape } from './escapeStack';
import { getFocusReturnTarget } from './focusTracker';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  // Classes du panneau (positionnement porté par l'appelant, dans un parent `relative`).
  className?: string;
  children: ReactNode;
}

export function Popover({ open, onClose, className, children }: Readonly<PopoverProps>) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const [order] = useState(nextEscapeOrder);
  // Capturé en layout effect à l'ouverture, avant les effets des enfants.
  const triggerRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) {
      triggerRef.current = getFocusReturnTarget();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const release = pushEscape({ onEscape: () => onCloseRef.current(), order });
    return () => {
      release();
      const trigger = triggerRef.current;
      triggerRef.current = null;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open, order]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" aria-hidden="true" onClick={onClose} />
      <div className={`z-50 ${className ?? ''}`}>{children}</div>
    </>
  );
}
