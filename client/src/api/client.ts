import type { Account, AccountType, Bank, Category, PaymentMethod, Transaction, TransactionFilters, PaginatedTransactions, ScheduledTransaction, UserSettings } from '@/types';

function extractError(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'object' && value !== null) {
    const messages: string[] = [];
    for (const [key, val] of Object.entries(value)) {
      if (key === '_errors' && Array.isArray(val)) messages.push(...val.filter(Boolean));
      else { const nested = extractError(val); if (nested) messages.push(nested); }
    }
    return messages.join(' · ');
  }
  return '';
}

async function parseResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractError((data as { error?: unknown }).error) || 'Request failed');
  return data as T;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
  create: (payload: { name: string }) => request<Bank>('POST', '/api/banks', payload),
  update: (id: number, payload: { name: string }) => request<Bank>('PUT', `/api/banks/${id}`, payload),
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
  create: (payload: { name: string }) => request<AccountType>('POST', '/api/account-types', payload),
  update: (id: number, payload: { name: string }) => request<AccountType>('PUT', `/api/account-types/${id}`, payload),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/account-types/${id}`),
};

type AccountPayload = { name: string; bank_id: number | null; account_type_id: number | null; initial_balance: number; opening_date: string };

// Accounts
export const accountsApi = {
  list: () => request<Account[]>('GET', '/api/accounts'),
  create: (payload: AccountPayload) => request<Account>('POST', '/api/accounts', payload),
  update: (id: number, payload: AccountPayload) => request<Account>('PUT', `/api/accounts/${id}`, payload),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/accounts/${id}`),
};

// Categories
export const categoriesApi = {
  list: () => request<Category[]>('GET', '/api/categories'),
  create: (payload: { name: string; color: string }) => request<Category>('POST', '/api/categories', payload),
  update: (id: number, payload: { name: string; color: string }) => request<Category>('PUT', `/api/categories/${id}`, payload),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/categories/${id}`),
};

// Payment methods
export const paymentMethodsApi = {
  list: () => request<PaymentMethod[]>('GET', '/api/payment-methods'),
  create: (payload: { name: string; icon: string }) => request<PaymentMethod>('POST', '/api/payment-methods', payload),
  update: (id: number, payload: { name: string; icon: string }) => request<PaymentMethod>('PUT', `/api/payment-methods/${id}`, payload),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/payment-methods/${id}`),
};

// Transfers
export const transfersApi = {
  create: (payload: { from_account_id: number; to_account_id: number; amount: number; description: string; date: string }) =>
    request<{ expense: Transaction; income: Transaction }>('POST', '/api/transfers', payload),
};

// Scheduled transactions
export type ScheduledPayload = {
  account_id: number;
  to_account_id: number | null;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category_id: number;
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
  create: (payload: ScheduledPayload) => request<ScheduledTransaction>('POST', '/api/scheduled', payload),
  update: (id: number, payload: ScheduledPayload) => request<ScheduledTransaction>('PUT', `/api/scheduled/${id}`, payload),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/scheduled/${id}`),
};

// User settings
export const settingsApi = {
  get: () => request<UserSettings>('GET', '/api/settings'),
  update: (payload: UserSettings) => request<UserSettings>('PUT', '/api/settings', payload),
};

// Transactions
export const transactionsApi = {
  list: (filters?: TransactionFilters) => {
    const params = new URLSearchParams();
    if (filters?.account_id  != null) params.set('account_id',  String(filters.account_id));
    if (filters?.type        != null) params.set('type',         filters.type);
    if (filters?.category_id != null) params.set('category_id',  String(filters.category_id));
    if (filters?.page        != null) params.set('page',         String(filters.page));
    if (filters?.limit       != null) params.set('limit',        String(filters.limit));
    const qs = params.toString();
    const url = qs ? `/api/transactions?${qs}` : '/api/transactions';
    return request<PaginatedTransactions>('GET', url);
  },
  create: (payload: {
    account_id: number;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    category_id: number;
    date: string;
    payment_method_id: number;
    notes?: string | null;
  }) => request<Transaction>('POST', '/api/transactions', payload),
  update: (id: number, payload: {
    account_id: number;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    category_id: number;
    date: string;
    payment_method_id: number;
    notes: string | null;
    validated: boolean;
  }) => request<Transaction>('PUT', `/api/transactions/${id}`, payload),
  validate: (id: number, validated: boolean) =>
    request<Transaction>('PATCH', `/api/transactions/${id}/validate`, { validated }),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/transactions/${id}`),
};
