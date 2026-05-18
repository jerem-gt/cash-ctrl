import { ReimbursementStatus, StockOperationType, TransactionType } from '../../constants';

export interface TransactionSplit {
  id: number;
  subcategory_id: number;
  amount: number;
}

export interface Transaction {
  id: number;
  user_id: number;
  account_id: number;
  type: TransactionType;
  amount: number;
  description: string;
  category_id: number | null;
  subcategory_id: number | null;
  category: string;
  subcategory: string;
  date: string;
  transfer_peer_id: number | null;
  transfer_peer_account_id: number | null;
  scheduled_id: number | null;
  validated: number;
  payment_method_id: number | null;
  payment_method: string;
  notes: string | null;
  reimbursement_status: ReimbursementStatus | null;
  loan_principal: number | null;
  created_at: string;
  account_name?: string;
  splits?: TransactionSplit[];
  stock_operation?: {
    id: number;
    account_id: number;
    transaction_id: number;
    ticker: string;
    type: StockOperationType;
    quantity: number;
    price_per_share: number;
    fees: number;
    date: string;
    created_at: string;
  } | null;
}

export interface CreateScheduledTransactionInput {
  account_id: number;
  type: TransactionType;
  amount: number;
  description: string;
  subcategory_id: number;
  date: string;
  payment_method_id: number;
  notes: string | null;
  scheduled_id: number;
}

export interface CreateTransactionInput {
  account_id: number;
  type: TransactionType;
  amount: number;
  description: string;
  subcategory_id: number | null;
  splits?: { subcategory_id: number; amount: number }[];
  date: string;
  payment_method_id: number;
  notes: string | null;
  validated: boolean;
  reimbursement_status?: ReimbursementStatus | null;
}

export interface UpdateSharedTransactionInput {
  amount: number;
  description: string;
  date: string;
  validated: boolean;
  this_account_id?: number;
  peer_account_id?: number;
}

export interface TransactionFilters {
  account_id?: number;
  type?: TransactionType;
  category_id?: number;
  subcategory_id?: number;
  description_contains?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  payment_method_id?: number;
  validated?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  balance_before_page?: number;
}

export type QueryParams = Record<string, string | number | null | bigint>;
