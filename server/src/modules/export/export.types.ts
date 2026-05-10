export interface FullExportAccountType {
  id: number;
  name: string;
  is_investment: number;
  is_loan: number;
}

export interface FullExportBank {
  id: number;
  name: string;
  logo: string | null;
  domain: string | null;
}

export interface FullExportAccount {
  id: number;
  name: string;
  bank_id: number | null;
  account_type_id: number;
  initial_balance: number;
  opening_date: string | null;
  closed_at: string | null;
}

export interface FullExportSubcategory {
  id: number;
  name: string;
}

export interface FullExportCategory {
  id: number;
  name: string;
  icon: string;
  subcategories: FullExportSubcategory[];
}

export interface FullExportPaymentMethod {
  id: number;
  name: string;
  icon: string;
}

export interface FullExportSplit {
  subcategory_id: number;
  amount: number;
}

export interface FullExportTransaction {
  id: number;
  account_id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  subcategory_id: number | null;
  payment_method_id: number | null;
  date: string;
  validated: number;
  notes: string | null;
  transfer_peer_id: number | null;
  reimbursement_status: 'en_attente' | 'rembourse' | null;
  scheduled_id: number | null;
  splits: FullExportSplit[];
}

export interface FullExportScheduled {
  id: number;
  account_id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  subcategory_id: number | null;
  payment_method_id: number | null;
  notes: string | null;
  recurrence_unit: string;
  recurrence_interval: number;
  recurrence_day: number | null;
  recurrence_month: number | null;
  to_account_id: number | null;
  weekend_handling: string;
  start_date: string;
  end_date: string | null;
  active: number;
}

export interface FullExportStockPosition {
  account_id: number;
  ticker: string;
  quantity: number;
  avg_price: number;
}

export interface FullExportStockOperation {
  id: number;
  account_id: number;
  transaction_id: number;
  fees_transaction_id: number | null;
  ticker: string;
  type: 'buy' | 'sell';
  quantity: number;
  price_per_share: number;
  fees: number;
  date: string;
}

export interface FullExportLoanInstallment {
  installment_number: number;
  due_date: string;
  total_amount: number;
  principal_amount: number;
  interest_amount: number;
  transaction_id: number | null;
}

export interface FullExportLoan {
  id: number;
  account_id: number;
  principal_amount: number;
  interest_rate: number;
  duration_months: number;
  start_date: string;
  monthly_payment: number;
  source_account_id: number;
  deposit_account_id: number;
  deposit_transaction_id: number | null;
  installments: FullExportLoanInstallment[];
}

export interface FullExport {
  version: '1.0';
  exported_at: string;
  amounts_in_cents: true;
  account_types: FullExportAccountType[];
  banks: FullExportBank[];
  accounts: FullExportAccount[];
  categories: FullExportCategory[];
  payment_methods: FullExportPaymentMethod[];
  transactions: FullExportTransaction[];
  scheduled_transactions: FullExportScheduled[];
  stock_positions: FullExportStockPosition[];
  stock_operations: FullExportStockOperation[];
  loans: FullExportLoan[];
}
