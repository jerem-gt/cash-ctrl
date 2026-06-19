// ─── Constants / Union types ──────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense';
export type InsuranceSupportType = 'uc' | 'euro';
export type ReimbursementStatus = 'en_attente' | 'rembourse' | null;
export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year';
export type WeekendHandling = 'allow' | 'before' | 'after';
export type InsuranceOperationType =
  | 'versement'
  | 'rachat'
  | 'arbitrage_in'
  | 'arbitrage_out'
  | 'interets'
  | 'revalorisation';
export type StockOperationType = 'buy' | 'sell' | 'transfer_in' | 'transfer_out';

// ─── Users ────────────────────────────────────────────────────────────────────

export interface UserPublic {
  id: number;
  username: string;
  is_admin: number;
  created_at: string;
  account_count: number;
  tx_count: number;
  last_tx_date: string | null;
}

// ─── Banks ────────────────────────────────────────────────────────────────────

export interface Bank {
  id: number;
  name: string;
  logo: string | null;
  login_url: string | null;
  sort_order: number;
  acc_count?: number;
}

// ─── Account types ────────────────────────────────────────────────────────────

export interface AccountType {
  id: number;
  name: string;
  envelope_type: string | null;
  acc_count?: number;
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export interface Account {
  id: number;
  name: string;
  bank_id: number | null;
  bank: string;
  account_type_id: number | null;
  type: string;
  envelope_type: string | null;
  initial_balance: number;
  opening_date: string | null;
  closed_at: string | null;
  balance: number;
  balance_all: number;
  balance_stocks: number;
  balance_insurance: number;
  capital_restant_du: number | null;
  capital_restant_du_all: number | null;
}

// ─── Categories ───────────────────────────────────────────────────────────────

export interface Subcategory {
  id: number;
  name: string;
  tx_count?: number;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  tx_count?: number;
  subcategories: Subcategory[];
}

// ─── Payment methods ──────────────────────────────────────────────────────────

export interface PaymentMethod {
  id: number;
  name: string;
  icon: string;
  tx_count?: number;
}

// ─── Tax / Fiscal ─────────────────────────────────────────────────────────────

export interface TaxBracket {
  id: number;
  year: number;
  min_income: number;
  max_income: number | null;
  rate: number;
  created_at: string;
}

export interface TaxYearParams {
  year: number;
  abattement_rate: number;
  abattement_min: number;
  abattement_max: number;
  pass: number;
  created_at: string;
}

export interface TaxYearData {
  year: number;
  params: TaxYearParams;
  brackets: TaxBracket[];
}

// ─── Insurance ────────────────────────────────────────────────────────────────

export interface InsuranceSupport {
  id: number;
  account_id: number;
  name: string;
  type: InsuranceSupportType;
  ticker: string | null;
  created_at: string;
}

export interface InsuranceSupportView {
  id: number;
  account_id: number;
  name: string;
  type: InsuranceSupportType;
  ticker: string | null;
  value: number;
}

export interface InsuranceOperation {
  id: number;
  account_id: number;
  support_id: number;
  support_name: string;
  support_type: InsuranceSupportType;
  transaction_id: number | null;
  fees_transaction_id: number | null;
  social_fees_transaction_id: number | null;
  type: InsuranceOperationType;
  amount: number;
  fees: number;
  social_fees: number;
  date: string;
  arbitrage_peer_id: number | null;
  created_at: string;
  from_scheduled: boolean;
}

// ─── Loans ────────────────────────────────────────────────────────────────────

export interface Loan {
  id: number;
  account_id: number;
  user_id: number;
  principal_amount: number;
  interest_rate: number;
  duration_months: number;
  start_date: string;
  monthly_payment: number;
  source_account_id: number;
  deposit_account_id: number;
  deposit_transaction_id: number | null;
  created_at: string;
}

export interface LoanInstallment {
  id: number;
  loan_id: number;
  installment_number: number;
  due_date: string;
  total_amount: number;
  principal_amount: number;
  interest_amount: number;
  transaction_id: number | null;
  transaction_validated: number | null;
}

// ─── Stocks ───────────────────────────────────────────────────────────────────

export interface StockPosition {
  id: number;
  account_id: number;
  ticker: string;
  quantity: number;
  avg_price: number;
  current_price: number | null;
  currency: string;
  name: string | null;
  price_fetched_at: string | null;
  updated_at: string;
  created_at: string;
}

export interface StockOperation {
  id: number;
  account_id: number;
  transaction_id: number | null;
  fees_transaction_id: number | null;
  ticker: string;
  type: StockOperationType;
  quantity: number;
  price_per_share: number;
  fees: number;
  date: string;
  transfer_peer_id: number | null;
  created_at: string;
}

export interface StockPrice {
  ticker: string;
  price: number;
  currency: string;
  name: string | null;
  fetched_at: string;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface TransactionSplit {
  id: number;
  subcategory_id: number;
  amount: number;
}

export interface Transaction {
  id: number;
  account_id: number;
  type: TransactionType;
  amount: number;
  description: string;
  subcategory_id: number | null;
  subcategory: string;
  category_id: number;
  category: string;
  date: string;
  transfer_peer_id: number | null;
  transfer_peer_account_id?: number | null;
  scheduled_id: number | null;
  validated: 0 | 1;
  payment_method_id: number | null;
  payment_method: string;
  notes: string | null;
  reimbursement_status: ReimbursementStatus;
  loan_principal: number | null;
  account_name?: string;
  remaining_reimbursable?: number;
  splits?: TransactionSplit[];
  stock_operation?: StockOperation | null;
}

export interface Reimbursement {
  id: number;
  amount: number;
  transaction_amount: number;
  description: string;
  date: string;
  subcategory: string;
  category: string;
  payment_method: string;
}

export interface PendingReimbursement {
  id: number;
  amount: number;
  description: string;
  date: string;
  subcategory: string;
  category: string;
  account_name: string;
  total_reimbursed: number;
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
  scheduled_id?: number;
  exclude_linked_reimbursements?: boolean;
  page?: number;
  limit?: number;
}

export type Filters = Omit<TransactionFilters, 'page' | 'limit'>;

export interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  page: number;
  totalPages: number;
  balance_before_page?: number;
}

// ─── Scheduled transactions ───────────────────────────────────────────────────

export interface ScheduledTransaction {
  id: number;
  account_id: number;
  to_account_id: number | null;
  type: TransactionType;
  amount: number;
  description: string;
  subcategory_id: number | null;
  subcategory: string;
  category_id: number;
  category: string;
  payment_method_id: number | null;
  payment_method: string;
  insurance_support_id: number | null;
  insurance_fees: number;
  insurance_support_name: string;
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
  transaction_count: number;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface UserSettings {
  lead_days: number;
  backup_enabled: boolean;
  backup_frequency_h: number;
  backup_max_files: number;
  backup_last_at: string | null;
  financial_income_category_id: number | null;
  transfer_subcategory_id: number | null;
  transfer_payment_method_id: number | null;
  bank_fees_subcategory_id: number | null;
  social_fees_subcategory_id: number | null;
  prelevement_payment_method_id: number | null;
}

export type SettingsUpdate = Pick<
  UserSettings,
  'lead_days' | 'backup_enabled' | 'backup_frequency_h' | 'backup_max_files'
>;

export type SystemRefsPayload = Partial<{
  financial_income_category_id: number | null;
  transfer_subcategory_id: number | null;
  transfer_payment_method_id: number | null;
  bank_fees_subcategory_id: number | null;
  social_fees_subcategory_id: number | null;
  prelevement_payment_method_id: number | null;
}>;

// ─── Backup ───────────────────────────────────────────────────────────────────

export interface BackupFile {
  filename: string;
  size: number;
  created_at: string;
}

export interface AppVersion {
  version: string;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface MonthlyStat {
  month: string;
  income: number;
  expense: number;
}

export interface DashboardStats {
  month_income: number;
  month_expense: number;
  monthly: MonthlyStat[];
  expenses_by_category: Array<{ category: string; amount: number }>;
  recent: Transaction[];
  to_validate: Transaction[];
  upcoming: Transaction[];
}

export interface BalanceHistoryData {
  account_types: string[];
  data: Array<Record<string, string | number>>;
}

export interface YearlyReturn {
  year: string;
  start_value: number;
  end_value: number;
  net_flows: number;
  gain: number;
  return_pct: number | null;
  is_ytd: boolean;
}

export interface AccountProfitability {
  account_id: number;
  account_name: string;
  envelope_type: string | null;
  account_type: string;
  opening_date: string;
  capital_investi: number;
  capital_retire: number;
  valeur_actuelle: number;
  plus_value_absolue: number;
  rendement_total_pct: number;
  rendement_annualise_pct: number | null;
  yearly_returns: YearlyReturn[];
}

export interface ReportData {
  income_total: number;
  expense_total: number;
  monthly: MonthlyStat[];
  expense_by_category: Array<{ category: string; amount: number }>;
  income_by_category: Array<{ category: string; amount: number }>;
}

// ─── API Payloads ─────────────────────────────────────────────────────────────

export type CreateTransferPayload = {
  from_account_id: number;
  to_account_id: number;
  amount: number;
  description: string;
  date: string;
  notes?: string | null;
  validated?: boolean;
};

export type UpdateTransferPayload = {
  amount: number;
  description: string;
  date: string;
  validated: boolean;
  from_account_id?: number;
  to_account_id?: number;
};

export type ScheduledPayload = {
  account_id: number;
  to_account_id: number | null;
  type: TransactionType;
  amount: number;
  description: string;
  subcategory_id: number | null;
  payment_method_id: number | null;
  insurance_support_id: number | null;
  insurance_fees: number;
  notes: string | null;
  recurrence_unit: RecurrenceUnit;
  recurrence_interval: number;
  recurrence_day: number | null;
  recurrence_month: number | null;
  weekend_handling: WeekendHandling;
  start_date: string;
  end_date: string | null;
  active: boolean;
};

export interface CreateTransactionPayload {
  account_id: number;
  type: TransactionType;
  amount: number;
  description: string;
  subcategory_id: number | null;
  splits?: Pick<TransactionSplit, 'subcategory_id' | 'amount'>[];
  date: string;
  payment_method_id: number;
  notes?: string | null;
  reimbursement_status?: ReimbursementStatus;
  validated: boolean;
}

export interface UpdateTransactionPayload {
  account_id: number;
  type: TransactionType;
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

export type BackupRunResult =
  | { skipped: false; filename: string }
  | { skipped: true; filename: null };

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

export type CreateSupportPayload = {
  name: string;
  type: InsuranceSupportType;
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
    type: TransactionType;
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
