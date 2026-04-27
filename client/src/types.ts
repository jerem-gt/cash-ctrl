export interface Bank {
  id: number;
  name: string;
  logo: string | null;
  domain: string | null;
  acc_count?: number;
}

export interface AccountType {
  id: number;
  name: string;
  acc_count?: number;
}

export type TransactionType = 'income' | 'expense';

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  tx_count?: number;
  subcategories: Subcategory[];
}

export interface Subcategory {
  id: number;
  name: string;
}

export interface Account {
  id: number;
  name: string;
  bank_id: number | null;
  bank: string; // résolu par JOIN
  account_type_id: number | null;
  type: string; // résolu par JOIN
  initial_balance: number;
  opening_date: string | null;
  balance: number;
}

export interface Transaction {
  id: number;
  account_id: number;
  type: TransactionType;
  amount: number;
  description: string;
  subcategory_id: number | null;
  subcategory: string; // résolu par JOIN
  category_id: number; // résolu par JOIN
  category: string; // résolu par JOIN
  date: string;
  transfer_peer_id: number | null;
  transfer_peer_account_id?: number | null;
  scheduled_id: number | null;
  validated: 0 | 1;
  payment_method_id: number | null;
  payment_method: string; // résolu par JOIN
  notes: string | null;
  account_name?: string;
}

export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year';
export type WeekendHandling = 'allow' | 'before' | 'after';

export interface ScheduledTransaction {
  id: number;
  account_id: number;
  to_account_id: number | null;
  type: TransactionType;
  amount: number;
  description: string;
  subcategory_id: number | null;
  subcategory: string; // résolu par JOIN
  category_id: number; // résolu par JOIN
  category: string; // résolu par JOIN
  payment_method_id: number | null;
  payment_method: string; // résolu par JOIN
  notes: string | null;
  recurrence_unit: RecurrenceUnit;
  recurrence_interval: number;
  recurrence_day: number | null;
  recurrence_month: number | null;
  weekend_handling: WeekendHandling;
  start_date: string;
  end_date: string | null;
  active: 0 | 1;
  account_name?: string;
}

export interface UserSettings {
  lead_days: number;
}

export interface PaymentMethod {
  id: number;
  name: string;
  icon: string;
  tx_count?: number;
}

export interface TransactionFilters {
  account_id?: number;
  type?: TransactionType;
  category_id?: number;
  subcategory_id?: number;
  page?: number;
  limit?: number;
}

export interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  page: number;
  totalPages: number;
}
