import { useEffect, useRef } from 'react';

export function useClickOutside<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [onClose]);

  return ref;
}
