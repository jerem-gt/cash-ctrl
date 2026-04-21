export interface Bank {
  id: number;
  name: string;
  logo: string | null;
}

export interface AccountType {
  id: number;
  name: string;
}

export type TransactionType = 'income' | 'expense';

export interface Category {
  id: number;
  name: string;
  color: string;
}

export interface Account {
  id: number;
  name: string;
  bank: string;
  type: string;
  initial_balance: number;
}

export interface Transaction {
  id: number;
  account_id: number;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  date: string;
  transfer_peer_id: number | null;
  validated: 0 | 1;
  payment_method: string;
  notes: string | null;
  account_name?: string;
}

export interface PaymentMethod {
  id: number;
  name: string;
  icon: string;
}

export interface TransactionFilters {
  account_id?: number;
  type?: TransactionType;
  category?: string;
}
