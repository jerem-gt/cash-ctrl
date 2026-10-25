export function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse une date SQLite `datetime('now')` (UTC, sans fuseau) ; les chaînes ISO avec fuseau sont inchangées. */
export function parseSqliteUtc(s: string): Date {
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) return new Date(s);
  return new Date(s.replace(' ', 'T') + 'Z');
}

export function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00');
}
