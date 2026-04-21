export interface Bank {
  id: number;
  name: string;
  logo: string | null;
  created_at: string;
}

export interface AccountType {
  id: number;
  name: string;
  created_at: string;
}

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
  type: string;
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
  validated: boolean;
  payment_method: string;
  notes: string | null;
  created_at: string;
  account_name: string;
}

export interface PaymentMethod {
  id: number;
  name: string;
  icon: string;
  created_at: string;
}

export interface TransactionFilters {
  account_id?: number;
  type?: TransactionType;
  category?: string;
}
