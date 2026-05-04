import type {
  Account,
  AccountType,
  AppVersion,
  Bank,
  Category,
  Loan,
  LoanInstallment,
  PaginatedTransactions,
  PaymentMethod,
  PendingReimbursement,
  Reimbursement,
  ScheduledTransaction,
  StockOperation,
  StockPosition,
  StockPrice,
  Transaction,
  TransactionFilters,
  TransactionSplit,
  UserSettings,
} from '@/types';

function extractError(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'object' && value !== null) {
    const messages: string[] = [];
    for (const [key, val] of Object.entries(value)) {
      if (key === '_errors' && Array.isArray(val)) messages.push(...val.filter(Boolean));
      else {
        const nested = extractError(val);
        if (nested) messages.push(nested);
      }
    }
    return messages.join(' · ');
  }
  return '';
}

async function parseResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(extractError((data as { error?: unknown }).error) || 'Request failed');
  return data as T;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

// Auth
export const authApi = {
  me: () => request<{ username: string }>('GET', '/api/auth/me'),
  login: (username: string, password: string) =>
    request<{ username: string }>('POST', '/api/auth/login', { username, password }),
  logout: () => request<{ ok: boolean }>('POST', '/api/auth/logout'),
  changePassword: (current: string, next: string) =>
    request<{ ok: boolean }>('POST', '/api/auth/change-password', { current, next }),
};

// Banks
export const banksApi = {
  list: () => request<Bank[]>('GET', '/api/banks'),
  create: (payload: { name: string; domain?: string | null }) =>
    request<Bank>('POST', '/api/banks', payload),
  update: (id: number, payload: { name: string; domain?: string | null }) =>
    request<Bank>('PUT', `/api/banks/${id}`, payload),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/banks/${id}`),
  uploadLogo: async (id: number, file: File): Promise<Bank> => {
    const fd = new FormData();
    fd.append('logo', file);
    const res = await fetch(`/api/banks/${id}/logo`, { method: 'POST', body: fd });
    return parseResponse<Bank>(res);
  },
};

// Account types
export const accountTypesApi = {
  list: () => request<AccountType[]>('GET', '/api/account-types'),
  create: (payload: { name: string; is_investment: boolean; is_loan: boolean }) =>
    request<AccountType>('POST', '/api/account-types', payload),
  update: (id: number, payload: { name: string; is_investment: boolean; is_loan: boolean }) =>
    request<AccountType>('PUT', `/api/account-types/${id}`, payload),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/account-types/${id}`),
};

type AccountPayload = {
  name: string;
  bank_id: number | null;
  account_type_id: number | null;
  initial_balance: number;
  opening_date: string;
};

// Accounts
export const accountsApi = {
  list: () => request<Account[]>('GET', '/api/accounts'),
  create: (payload: AccountPayload) => request<Account>('POST', '/api/accounts', payload),
  update: (id: number, payload: AccountPayload) =>
    request<Account>('PUT', `/api/accounts/${id}`, payload),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/accounts/${id}`),
  close: (id: number, payload: { closed_at: string; transfer_to_account_id?: number }) =>
    request<Account>('POST', `/api/accounts/${id}/close`, payload),
  reopen: (id: number) => request<Account>('POST', `/api/accounts/${id}/reopen`),
};

// Categories
export const categoriesApi = {
  list: () => request<Category[]>('GET', '/api/categories'),
  create: (payload: { name: string; color: string; icon: string }) =>
    request<Category>('POST', '/api/categories', payload),
  update: (id: number, payload: { name: string; color: string; icon: string }) =>
    request<Category>('PUT', `/api/categories/${id}`, payload),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/categories/${id}`),
};

// Subcategories
export const subcategoriesApi = {
  list: () => request<Category[]>('GET', '/api/subcategories'),
  create: (payload: { name: string; category_id: number }) =>
    request<Category>('POST', '/api/subcategories', payload),
  update: (id: number, payload: { name: string }) =>
    request<Category>('PUT', `/api/subcategories/${id}`, payload),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/subcategories/${id}`),
};

// Payment methods
export const paymentMethodsApi = {
  list: () => request<PaymentMethod[]>('GET', '/api/payment-methods'),
  create: (payload: { name: string; icon: string }) =>
    request<PaymentMethod>('POST', '/api/payment-methods', payload),
  update: (id: number, payload: { name: string; icon: string }) =>
    request<PaymentMethod>('PUT', `/api/payment-methods/${id}`, payload),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/payment-methods/${id}`),
};

// Transfers
export const transfersApi = {
  create: (payload: {
    from_account_id: number;
    to_account_id: number;
    amount: number;
    description: string;
    date: string;
    notes?: string | null;
    validated?: boolean;
  }) => request<{ expense: Transaction; income: Transaction }>('POST', '/api/transfers', payload),
};

// Scheduled transactions
export type ScheduledPayload = {
  account_id: number;
  to_account_id: number | null;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  subcategory_id: number;
  payment_method_id: number;
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

export const scheduledApi = {
  list: () => request<ScheduledTransaction[]>('GET', '/api/scheduled'),
  create: (payload: ScheduledPayload) =>
    request<ScheduledTransaction>('POST', '/api/scheduled', payload),
  update: (id: number, payload: ScheduledPayload) =>
    request<ScheduledTransaction>('PUT', `/api/scheduled/${id}`, payload),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/scheduled/${id}`),
};

// User settings
export const settingsApi = {
  get: () => request<UserSettings>('GET', '/api/settings'),
  update: (payload: UserSettings) => request<UserSettings>('PUT', '/api/settings', payload),
};

// Version
export const versionApi = {
  get: () => request<AppVersion>('GET', '/api/version'),
};

// Stocks
export type StockOperationPayload = {
  ticker: string;
  quantity: number;
  price_per_share: number;
  fees: number;
  date: string;
  description?: string;
};

export type UpdateOperationPayload = Omit<StockOperationPayload, 'ticker'>;

export const stocksApi = {
  positions: (accountId: number) =>
    request<StockPosition[]>('GET', `/api/stocks/${accountId}/positions`),
  operations: (accountId: number) =>
    request<StockOperation[]>('GET', `/api/stocks/${accountId}/operations`),
  buy: (accountId: number, payload: StockOperationPayload) =>
    request<{ operation: StockOperation; transaction_id: number }>(
      'POST',
      `/api/stocks/${accountId}/buy`,
      payload,
    ),
  sell: (accountId: number, payload: StockOperationPayload) =>
    request<{ operation: StockOperation; transaction_id: number }>(
      'POST',
      `/api/stocks/${accountId}/sell`,
      payload,
    ),
  price: (ticker: string) => request<StockPrice>('GET', `/api/stocks/price/${ticker}`),
  refreshPrices: () => request<{ ok: boolean }>('POST', '/api/stocks/prices/refresh'),
  updateOperation: (accountId: number, operationId: number, payload: UpdateOperationPayload) =>
    request<StockOperation>('PUT', `/api/stocks/${accountId}/operations/${operationId}`, payload),
};

// Loans
export type CreateLoanPayload = {
  name: string;
  bank_id: number | null;
  opening_date: string;
  principal_amount: number;
  interest_rate: number;
  duration_months: number;
  start_date: string;
  source_account_id: number;
};

export type UpdateLoanPayload = {
  name: string;
  bank_id: number | null;
  opening_date: string;
  source_account_id: number;
};

export const loansApi = {
  create: (payload: CreateLoanPayload) => request<Loan>('POST', '/api/loans', payload),
  update: (loanId: number, payload: UpdateLoanPayload) =>
    request<Loan>('PATCH', `/api/loans/${loanId}`, payload),
  getByAccount: (accountId: number) => request<Loan>('GET', `/api/loans/account/${accountId}`),
  getInstallments: (loanId: number) =>
    request<LoanInstallment[]>('GET', `/api/loans/${loanId}/installments`),
  updateInstallment: (
    loanId: number,
    installmentId: number,
    data: { due_date: string; total_amount: number },
  ) =>
    request<LoanInstallment>('PATCH', `/api/loans/${loanId}/installments/${installmentId}`, data),
};

// Reimbursements
export const reimbursementsApi = {
  pending: () => request<PendingReimbursement[]>('GET', '/api/reimbursements/pending'),
  list: (transactionId: number) =>
    request<Reimbursement[]>('GET', `/api/reimbursements/${transactionId}`),
  link: (transactionId: number, linked_transaction_id: number) =>
    request<Reimbursement[]>('POST', `/api/reimbursements/${transactionId}`, {
      linked_transaction_id,
    }),
  unlink: (transactionId: number, linkedId: number) =>
    request<{ ok: boolean }>('DELETE', `/api/reimbursements/${transactionId}/${linkedId}`),
  setStatus: (transactionId: number, reimbursement_status: 'en_attente' | 'rembourse' | null) =>
    request<Transaction>('PATCH', `/api/reimbursements/${transactionId}/status`, {
      reimbursement_status,
    }),
};

// Transactions
export const transactionsApi = {
  list: (filters?: TransactionFilters) => {
    const params = new URLSearchParams();
    if (filters?.account_id != null) params.set('account_id', String(filters.account_id));
    if (filters?.type != null) params.set('type', filters.type);
    if (filters?.category_id != null) params.set('category_id', String(filters.category_id));
    if (filters?.subcategory_id != null)
      params.set('subcategory_id', String(filters.subcategory_id));
    if (filters?.page != null) params.set('page', String(filters.page));
    if (filters?.limit != null) params.set('limit', String(filters.limit));
    const qs = params.toString();
    const url = qs ? `/api/transactions?${qs}` : '/api/transactions';
    return request<PaginatedTransactions>('GET', url);
  },
  create: (payload: {
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
  }) => request<Transaction>('POST', '/api/transactions', payload),
  update: (
    id: number,
    payload: {
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
    },
  ) => request<Transaction>('PUT', `/api/transactions/${id}`, payload),
  validate: (id: number, validated: boolean) =>
    request<Transaction>('PATCH', `/api/transactions/${id}/validate`, { validated }),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/transactions/${id}`),
};
