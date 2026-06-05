import { useEffect, useState } from 'react';

export function useActiveSection(ids: string[], offset = 60): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);

  useEffect(() => {
    if (ids.length === 0) return;

    function update() {
      const threshold = window.scrollY + offset;
      let found: string | null = ids[0] ?? null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top <= threshold) found = id;
      }
      setActive(found);
    }

    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [ids, offset]);

  return active;
}
