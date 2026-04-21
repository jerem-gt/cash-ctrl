import type { Account, Transaction } from '@/types';

export function computeBalance(account: Account, transactions: Transaction[]): number {
  return transactions
    .filter(t => t.account_id === account.id)
    .reduce((sum, t) => t.type === 'income' ? sum + t.amount : sum - t.amount, account.initial_balance);
}
