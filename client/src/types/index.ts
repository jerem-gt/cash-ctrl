export type AccountType = 'Courant' | 'Epargne' | 'Livret' | 'Credit' | 'Autre';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  Courant: 'Courant',
  Epargne: 'Épargne',
  Livret:  'Livret',
  Credit:  'Crédit',
  Autre:   'Autre',
};
export type TransactionType = 'income' | 'expense';

export interface Category {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Account {
  id: number;
  user_id: number;
  name: string;
  bank: string;
  type: AccountType;
  initial_balance: number;
  created_at: string;
}

export interface Transaction {
  id: number;
  user_id: number;
  account_id: number;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  date: string;
  transfer_peer_id: number | null;
  created_at: string;
  account_name: string;
}

export interface TransactionFilters {
  account_id?: number;
  type?: TransactionType;
  category?: string;
}
