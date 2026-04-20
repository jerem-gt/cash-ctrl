import type { Account, Category, Transaction, TransactionFilters } from '@/types';

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
    return request<Transaction[]>('GET', `/api/transactions${qs ? `?${qs}` : ''}`);
  },
  create: (payload: {
    account_id: number;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    category: string;
    date: string;
  }) => request<Transaction>('POST', '/api/transactions', payload),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/transactions/${id}`),
};
