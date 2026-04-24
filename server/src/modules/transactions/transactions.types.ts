export interface Transaction {
  id: number;
  user_id: number;
  account_id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category_id: number | null;
  category: string;
  date: string;
  transfer_peer_id: number | null;
  scheduled_id: number | null;
  validated: number;
  payment_method_id: number | null;
  payment_method: string;
  notes: string | null;
  created_at: string;
  account_name?: string;
}

export interface CreateScheduledTransactionInput {
  account_id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category_id: number;
  date: string;
  payment_method_id: number;
  notes: string | null;
  scheduled_id: number;
}

export interface CreateTransactionInput {
  account_id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category_id: number;
  date: string;
  payment_method_id: number;
  notes: string | null;
  validated: boolean;
}

export interface UpdateSharedTransactionInput {
  amount: number;
  description: string;
  date: string;
}

export interface TransactionFilters {
  account_id?: number;
  type?: 'income' | 'expense';
  category_id?: number;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}
