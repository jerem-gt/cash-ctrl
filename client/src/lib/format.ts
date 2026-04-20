export const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export const fmtDec = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

export const fmtDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

export const fmtDateShort = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

export const today = () => new Date().toISOString().split('T')[0];

export function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  const n = new Date();
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

export function monthLabel(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return d.toLocaleDateString('fr-FR', { month: 'short' });
}

export function isSameMonth(dateStr: string, offset: number): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  const ref = new Date();
  ref.setMonth(ref.getMonth() - offset);
  return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
}
