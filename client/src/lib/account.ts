import type { Account, Bank } from '@/types';

/**
 * Index { nom de banque → sort_order }, prêt à passer à groupAccountsByBank.
 * Les comptes sans banque (clé '') sont rangés en dernier au moment du tri.
 */
export function bankSortOrderMap(banks: Bank[]): Record<string, number> {
  return Object.fromEntries(banks.map((b) => [b.name, b.sort_order]));
}

/**
 * Regroupe une liste de comptes par banque puis trie les groupes selon
 * `sortOrderMap` (sort_order de la banque), avec les comptes sans banque
 * en dernier. À sort_order égal, tri alphabétique.
 */
export function groupAccountsByBank(
  accounts: Account[],
  sortOrderMap: Record<string, number>,
): { bank: string | null; accounts: Account[] }[] {
  const groupMap = new Map<string, Account[]>();
  for (const acc of accounts) {
    const key = acc.bank ?? '';
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(acc);
  }
  return [...groupMap.entries()]
    .sort(([a], [b]) => {
      if (a === '') return 1;
      if (b === '') return -1;
      const orderA = sortOrderMap[a] ?? Infinity;
      const orderB = sortOrderMap[b] ?? Infinity;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    })
    .map(([bank, accs]) => ({ bank: bank === '' ? null : bank, accounts: accs }));
}

export function accountDisplayBalance(a: Account): number {
  if (a.envelope_type === 'life_insurance' || a.envelope_type === 'per') {
    return a.balance_insurance;
  }
  return a.balance + a.balance_stocks;
}

export function accountSeniority(openingDate: string): string {
  const open = new Date(openingDate + 'T00:00:00');
  const now = new Date();
  let years = now.getFullYear() - open.getFullYear();
  let months = now.getMonth() - open.getMonth();
  if (now.getDate() < open.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years === 0 && months === 0) return "moins d'un mois";
  if (years === 0) return `${months} mois`;
  if (months === 0) return `${years} an${years > 1 ? 's' : ''}`;
  return `${years} an${years > 1 ? 's' : ''} ${months} mois`;
}
