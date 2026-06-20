export const parseLocalDate = (s: string) => new Date(s + 'T00:00:00');

export const today = () => new Date().toISOString().split('T')[0];

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
