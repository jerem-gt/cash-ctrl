export function accountSeniority(openingDate: string): string {
  const open = new Date(openingDate + 'T00:00:00');
  const now = new Date();
  let years = now.getFullYear() - open.getFullYear();
  let months = now.getMonth() - open.getMonth();
  if (now.getDate() < open.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  if (years === 0 && months === 0) return "moins d'un mois";
  if (years === 0) return `${months} mois`;
  if (months === 0) return `${years} an${years > 1 ? 's' : ''}`;
  return `${years} an${years > 1 ? 's' : ''} ${months} mois`;
}
