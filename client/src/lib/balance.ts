import type { Transaction } from '@/types';

// Calcule le solde après chaque transaction pour une liste triée du plus récent
// au plus ancien (ordre DESC). runningBalances[i] = solde après transactions[i].
export function computeRunningBalances(
  transactions: Pick<Transaction, 'type' | 'amount'>[],
  currentBalance: number,
): number[] {
  const result: number[] = [];
  let balance = Math.round(currentBalance * 100) / 100;
  for (const tx of transactions) {
    result.push(balance);
    const delta = tx.type === 'income' ? tx.amount : -tx.amount;
    balance = Math.round((balance - delta) * 100) / 100;
  }
  return result;
}
