export type AccountRef = { name: string; bank?: string | null };

export function transferLabel(src?: AccountRef, dest?: AccountRef): string {
  if (!src) return '';
  if (!dest) return `${src.name} →`;
  if (src.bank && dest.bank && src.bank !== dest.bank) return `${src.bank} → ${dest.bank}`;
  return `${src.name} → ${dest.name}`;
}
