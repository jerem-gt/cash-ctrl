import type { Account, AccountType, Bank, Category, PaymentMethod, Transaction, TransactionFilters } from '@/types';

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Request failed');
  return data as T;
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Upload failed');
    return data as Bank;
  },
};

// Account types
export const accountTypesApi = {
  list: () => request<AccountType[]>('GET', '/api/account-types'),
  create: (payload: { name: string }) => request<AccountType>('POST', '/api/account-types', payload),
  update: (id: number, payload: { name: string }) => request<AccountType>('PUT', `/api/account-types/${id}`, payload),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/account-types/${id}`),
};

// Accounts
export const accountsApi = {
  list: () => request<Account[]>('GET', '/api/accounts'),
  create: (payload: { name: string; bank: string; type: string; initial_balance: number }) =>
    request<Account>('POST', '/api/accounts', payload),
  update: (id: number, payload: { name: string; bank: string; type: string; initial_balance: number }) =>
    request<Account>('PUT', `/api/accounts/${id}`, payload),
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
    request<{ expense: unknown; income: unknown }>('POST', '/api/transfers', payload),
};

// Transactions
export const transactionsApi = {
  list: (filters?: TransactionFilters) => {
    const params = new URLSearchParams();
    if (filters?.account_id) params.set('account_id', String(filters.account_id));
    if (filters?.type)       params.set('type', filters.type);
    if (filters?.category)   params.set('category', filters.category);
    const qs = params.toString();
    const url = qs ? `/api/transactions?${qs}` : '/api/transactions';
    return request<Transaction[]>('GET', url);
  },
  create: (payload: {
    account_id: number;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    category: string;
    date: string;
    payment_method?: string;
    notes?: string | null;
  }) => request<Transaction>('POST', '/api/transactions', payload),
  update: (id: number, payload: {
    account_id: number;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    category: string;
    date: string;
    payment_method: string;
    notes: string | null;
    validated: boolean;
  }) => request<Transaction>('PUT', `/api/transactions/${id}`, payload),
  validate: (id: number, validated: boolean) =>
    request<Transaction>('PATCH', `/api/transactions/${id}/validate`, { validated }),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/transactions/${id}`),
};
