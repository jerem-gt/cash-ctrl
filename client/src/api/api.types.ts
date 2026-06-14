import type { TransactionSplit } from '@/types';

// ── Scheduled ────────────────────────────────────────────────────────────────

export type ScheduledPayload = {
  account_id: number;
  to_account_id: number | null;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  subcategory_id: number | null;
  payment_method_id: number | null;
  insurance_support_id: number | null;
  insurance_fees: number;
  notes: string | null;
  recurrence_unit: 'day' | 'week' | 'month' | 'year';
  recurrence_interval: number;
  recurrence_day: number | null;
  recurrence_month: number | null;
  weekend_handling: 'allow' | 'before' | 'after';
  start_date: string;
  end_date: string | null;
  active: boolean;
};

// ── Transactions ──────────────────────────────────────────────────────────────

export interface CreateTransactionPayload {
  account_id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  subcategory_id: number | null;
  splits?: Pick<TransactionSplit, 'subcategory_id' | 'amount'>[];
  date: string;
  payment_method_id: number;
  notes?: string | null;
  reimbursement_status?: 'en_attente' | 'rembourse' | null;
  validated: boolean;
}

export interface UpdateTransactionPayload {
  account_id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  subcategory_id: number | null;
  splits?: Pick<TransactionSplit, 'subcategory_id' | 'amount'>[];
  date: string;
  payment_method_id: number;
  notes: string | null;
  validated: boolean;
  scheduled_id?: number | null;
}

// ── Backup ────────────────────────────────────────────────────────────────────

export type BackupRunResult =
  | { skipped: false; filename: string }
  | { skipped: true; filename: null };

// ── Stocks ────────────────────────────────────────────────────────────────────

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export type StockOperationPayload = {
  ticker: string;
  quantity: number;
  price_per_share: number;
  fees: number;
  date: string;
  description?: string;
};

export type UpdateOperationPayload = Omit<StockOperationPayload, 'ticker'>;

export type TransferStockPayload = {
  to_account_id: number;
  ticker: string;
  quantity: number;
  date: string;
};

// ── Insurance ─────────────────────────────────────────────────────────────────

export type CreateSupportPayload = {
  name: string;
  type: 'uc' | 'euro';
  ticker?: string | null;
};

export type InsuranceFlowPayload = {
  support_id: number;
  amount: number;
  fees: number;
  social_fees?: number;
  date: string;
  source_account_id?: number | null;
  dest_account_id?: number | null;
};

export type ArbitragePayload = {
  from_support_id: number;
  to_support_id: number;
  from_amount: number;
  fees: number;
  date: string;
};

export type InteretsPayload = {
  support_id: number;
  amount: number;
  date: string;
};

export type RevaloriserPayload = {
  support_id: number;
  amount: number;
  date: string;
};

// ── Loans ─────────────────────────────────────────────────────────────────────

export type CreateLoanPayload = {
  name: string;
  bank_id: number | null;
  opening_date: string | null;
  principal_amount: number;
  interest_rate: number;
  duration_months: number;
  start_date: string;
  source_account_id: number;
  deposit_account_id: number;
};

export type UpdateLoanPayload = {
  name: string;
  bank_id: number | null;
  opening_date: string | null;
  source_account_id: number;
};

// ── Import ────────────────────────────────────────────────────────────────────

export interface ImportExecuteBody {
  newAccounts: {
    source_name: string;
    name: string;
    bank_id: number | null;
    account_type_id: number | null;
    initial_balance: number;
    opening_date: string | null;
  }[];
  newSubcategories: {
    source_key: string;
    category_id?: number;
    new_category_name?: string;
    new_category_icon?: string;
    subcategory_name: string;
  }[];
  transactions: {
    account_id: number | null;
    new_account_source_name: string | null;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    subcategory_id: number | null;
    new_subcategory_key: string | null;
    date: string;
    notes: string | null;
    validated: boolean;
    payment_method_id: number | null;
  }[];
  transfers: {
    from_account_id: number | null;
    from_account_source_name: string | null;
    to_account_id: number | null;
    to_account_source_name: string | null;
    amount: number;
    description: string;
    date: string;
    notes: string | null;
    validated: boolean;
  }[];
}

export interface ImportResult {
  transactions: number;
  transfers: number;
}

export interface JsonFullImportResult {
  accounts: number;
  transactions: number;
  transfers: number;
  scheduled: number;
  stockOperations: number;
  loans: number;
  insuranceSupports: number;
  insuranceOperations: number;
}
