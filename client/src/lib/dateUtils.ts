export const parseLocalDate = (s: string) => new Date(s + 'T00:00:00');

// toISOString() convertit en UTC : entre minuit et l'heure du décalage local
// (ex. 0h-2h en heure d'été Europe/Paris), cela renvoie encore hier. On
// reconstruit la date à partir des composants locaux pour éviter ce décalage.
export function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isThisMonth(dateStr: string): boolean {
  const d = parseLocalDate(dateStr);
  const n = new Date();
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

export function isSameMonth(dateStr: string, offset: number): boolean {
  const d = parseLocalDate(dateStr);
  const ref = new Date();
  ref.setMonth(ref.getMonth() - offset);
  return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
}
