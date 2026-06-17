import { useEffect, useState } from 'react';

export function useActiveSection(ids: string[], offset = 60): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  // Dériver un primitif stable : le useEffect ne se ré-abonne que si le
  // contenu change, pas si le parent passe un nouveau tableau à chaque render.
  const idsKey = ids.join('\0');

  useEffect(() => {
    const stableIds = idsKey ? idsKey.split('\0') : [];
    if (stableIds.length === 0) return;

    function update() {
      const threshold = window.scrollY + offset;
      let found: string | null = stableIds[0] ?? null;
      for (const id of stableIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top <= threshold) found = id;
      }
      setActive(found);
    }

    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [idsKey, offset]);

  return active;
}
