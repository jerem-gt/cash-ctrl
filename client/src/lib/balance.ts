import type { Transaction } from '@cashctrl/types';

import { toCents, toEuros } from '@/lib/money';

// Calcule le solde après chaque transaction pour une liste triée du plus récent
// au plus ancien (ordre DESC). runningBalances[i] = solde après transactions[i].
export function computeRunningBalances(
  transactions: Pick<Transaction, 'type' | 'amount' | 'loan_principal'>[],
  currentBalance: number,
): number[] {
  const result: number[] = [];
  let balance = toEuros(toCents(currentBalance));
  for (const tx of transactions) {
    result.push(balance);
    const effectiveAmount = tx.loan_principal ?? tx.amount;
    const delta = tx.type === 'income' ? effectiveAmount : -effectiveAmount;
    balance = toEuros(toCents(balance - delta));
  }
  return result;
}
