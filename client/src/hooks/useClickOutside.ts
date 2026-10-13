import { useEffect, useLayoutEffect, useRef } from 'react';

export function useClickOutside<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) {
        onCloseRef.current();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return ref;
}
