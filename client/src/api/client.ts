import type {
  Account,
  AccountProfitability,
  AccountType,
  AppVersion,
  ArbitragePayload,
  BackupFile,
  BackupRunResult,
  BalanceHistoryData,
  Bank,
  Category,
  CreateLoanPayload,
  CreateSupportPayload,
  CreateTransactionPayload,
  CreateTransferPayload,
  DashboardStats,
  ImportExecuteBody,
  ImportResult,
  InsuranceFlowPayload,
  InsuranceOperation,
  InsuranceSupport,
  InsuranceSupportView,
  InteretsPayload,
  JsonFullImportResult,
  Loan,
  LoanInstallment,
  PaginatedTransactions,
  PaymentMethod,
  PendingReimbursement,
  Reimbursement,
  ReportData,
  RevaloriserPayload,
  ScheduledPayload,
  ScheduledTransaction,
  SettingsUpdate,
  StockOperation,
  StockOperationPayload,
  StockPosition,
  StockPrice,
  StockSearchResult,
  Subcategory,
  SystemRefsPayload,
  TaxYearData,
  Transaction,
  TransactionFilters,
  TransferStockPayload,
  UpdateLoanPayload,
  UpdateOperationPayload,
  UpdateTransactionPayload,
  UpdateTransferPayload,
  UserPublic,
  UserSettings,
} from '@cashctrl/types';

import i18n from '@/i18n';

export type {
  ArbitragePayload,
  BackupRunResult,
  CreateLoanPayload,
  CreateSupportPayload,
  CreateTransactionPayload,
  CreateTransferPayload,
  ImportExecuteBody,
  ImportResult,
  InsuranceFlowPayload,
  InteretsPayload,
  JsonFullImportResult,
  RevaloriserPayload,
  ScheduledPayload,
  StockOperationPayload,
  StockSearchResult,
  TransferStockPayload,
  UpdateLoanPayload,
  UpdateOperationPayload,
  UpdateTransactionPayload,
  UpdateTransferPayload,
} from '@cashctrl/types';

/** Corps d'erreur structuré renvoyé par l'API (cf. server/src/lib/errorCodes.ts). */
export interface ApiErrorField {
  path: string;
  code: string;
  params?: Record<string, string | number>;
  message: string;
}
export interface ApiErrorBody {
  code: string;
  message: string;
  params?: Record<string, string | number>;
  fields?: ApiErrorField[];
}

/** Erreur API : `message` est déjà traduit ; `body` porte la forme structurée (fields, etc.). */
export class ApiError extends Error {
  readonly status: number;
  readonly body?: ApiErrorBody;
  constructor(message: string, status: number, body?: ApiErrorBody) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && 'code' in value && 'message' in value;
}

/** Traduit un code via le namespace i18n `errors`, avec repli sur le message FR du serveur. */
function translateCode(
  code: string,
  message: string,
  params?: Record<string, string | number>,
): string {
  return i18n.t(`errors:${code}`, { ...params, defaultValue: message });
}

/** Traduit un champ d'erreur de validation (utilisé pour l'affichage par ligne, ex. import). */
export function translateErrorField(field: ApiErrorField): string {
  return translateCode(field.code, field.message, field.params);
}

/** Repli legacy pour les erreurs encore renvoyées en chaîne/arbre (ex. import QIF). */
function extractError(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'object' && value !== null) {
    const messages: string[] = [];
    for (const [key, val] of Object.entries(value)) {
      if (key === '_errors' && Array.isArray(val))
        messages.push(...(val as string[]).filter(Boolean));
      else {
        const nested = extractError(val);
        if (nested) messages.push(nested);
      }
    }
    return messages.join(' · ');
  }
  return '';
}

function formatError(error: unknown): string {
  if (isApiErrorBody(error)) {
    if (error.fields && error.fields.length > 0) {
      return error.fields.map(translateErrorField).join(' · ');
    }
    return translateCode(error.code, error.message, error.params);
  }
  return extractError(error);
}

async function parseResponse<T>(res: Response): Promise<T> {
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = (data as { error?: unknown }).error;
    const message = formatError(raw) || i18n.t('errors:common.internal');
    throw new ApiError(message, res.status, isApiErrorBody(raw) ? raw : undefined);
  }
  return data as T;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(i18n.t('errors:common.network'), 0);
  }
  return parseResponse<T>(res);
}

export interface MeData {
  username: string;
  isAdmin: boolean;
  totpEnabled: boolean;
}

export type LoginResponse = (MeData & { totp_required?: never }) | { totp_required: true };

// Auth
export const authApi = {
  me: () => request<MeData>('GET', '/api/auth/me'),
  login: (username: string, password: string) =>
    request<LoginResponse>('POST', '/api/auth/login', { username, password }),
  logout: () => request<{ ok: boolean }>('POST', '/api/auth/logout'),
  changePassword: (current: string, next: string) =>
    request<{ ok: boolean }>('POST', '/api/auth/change-password', { current, next }),
  setup2fa: () => request<{ uri: string; secret: string }>('POST', '/api/auth/2fa/setup'),
  enable2fa: (secret: string, code: string) =>
    request<{ ok: boolean }>('POST', '/api/auth/2fa/enable', { secret, code }),
  disable2fa: (password: string) =>
    request<{ ok: boolean }>('POST', '/api/auth/2fa/disable', { password }),
  verifyTotp: (code: string) => request<MeData>('POST', '/api/auth/2fa/verify', { code }),
};

// Users (admin only)
export const usersApi = {
  list: () => request<UserPublic[]>('GET', '/api/users'),
  create: (payload: { username: string; password: string; lang: 'fr' | 'en' }) =>
    request<UserPublic>('POST', '/api/users', payload),
  update: (id: number, payload: { username?: string; password?: string }) =>
    request<UserPublic>('PATCH', `/api/users/${id}`, payload),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/users/${id}`),
};

// Banks
export const banksApi = {
  list: () => request<Bank[]>('GET', '/api/banks'),
  create: (payload: { name: string; login_url?: string | null }) =>
    request<Bank>('POST', '/api/banks', payload),
  update: (id: number, payload: { name: string; login_url?: string | null }) =>
    request<Bank>('PUT', `/api/banks/${id}`, payload),
  reorder: (items: { id: number; sort_order: number }[]) =>
    request<{ ok: boolean }>('PUT', '/api/banks/reorder', items),
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
  create: (payload: { name: string; envelope_type: string | null }) =>
    request<AccountType>('POST', '/api/account-types', payload),
  update: (id: number, payload: { name: string; envelope_type: string | null }) =>
    request<AccountType>('PUT', `/api/account-types/${id}`, payload),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/account-types/${id}`),
};

type AccountPayload = {
  name: string;
  bank_id: number | null;
  account_type_id: number | null;
  initial_balance: number;
  opening_date: string | null;
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
  create: (payload: { name: string; icon: string }) =>
    request<Category>('POST', '/api/categories', payload),
  update: (id: number, payload: { name: string; icon: string }) =>
    request<Category>('PUT', `/api/categories/${id}`, payload),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/categories/${id}`),
};

// Subcategories
export const subcategoriesApi = {
  list: () => request<Category[]>('GET', '/api/subcategories'),
  create: (payload: { name: string; category_id: number }) =>
    request<Subcategory>('POST', '/api/subcategories', payload),
  update: (id: number, payload: { name: string }) =>
    request<Subcategory>('PUT', `/api/subcategories/${id}`, payload),
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
  create: (payload: CreateTransferPayload) =>
    request<{ expense: Transaction; income: Transaction }>('POST', '/api/transfers', payload),
  update: (id: number, payload: UpdateTransferPayload) =>
    request<Transaction>('PUT', `/api/transfers/${id}`, payload),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/transfers/${id}`),
};

// Scheduled transactions
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
  update: (payload: SettingsUpdate) => request<UserSettings>('PUT', '/api/settings', payload),
  updateSystemRefs: (payload: SystemRefsPayload) =>
    request<UserSettings>('PATCH', '/api/settings/system-refs', payload),
};

// Backup
export const backupApi = {
  list: () => request<BackupFile[]>('GET', '/api/backup/list'),
  run: () => request<BackupRunResult>('POST', '/api/backup/run'),
  downloadUrl: (filename: string) => `/api/backup/${encodeURIComponent(filename)}`,
};

// Version
export const versionApi = {
  get: () => request<AppVersion>('GET', '/api/version'),
};

// Stocks
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
  search: (q: string) =>
    request<StockSearchResult[]>('GET', `/api/stocks/search?q=${encodeURIComponent(q)}`),
  price: (ticker: string) => request<StockPrice>('GET', `/api/stocks/price/${ticker}`),
  refreshPrices: () => request<{ ok: boolean }>('POST', '/api/stocks/prices/refresh'),
  updateOperation: (accountId: number, operationId: number, payload: UpdateOperationPayload) =>
    request<StockOperation>('PUT', `/api/stocks/${accountId}/operations/${operationId}`, payload),
  transfer: (accountId: number, payload: TransferStockPayload) =>
    request<{ outOperation: StockOperation; inOperation: StockOperation }>(
      'POST',
      `/api/stocks/${accountId}/transfer`,
      payload,
    ),
};

// Insurance
export const insuranceApi = {
  supports: (accountId: number) =>
    request<InsuranceSupport[]>('GET', `/api/insurance/${accountId}/supports`),
  createSupport: (accountId: number, payload: CreateSupportPayload) =>
    request<InsuranceSupport>('POST', `/api/insurance/${accountId}/supports`, payload),
  deleteSupport: (accountId: number, supportId: number) =>
    request<{ ok: boolean }>('DELETE', `/api/insurance/${accountId}/supports/${supportId}`),
  deleteOperation: (accountId: number, operationId: number) =>
    request<{ ok: boolean }>('DELETE', `/api/insurance/${accountId}/operations/${operationId}`),
  updateOperation: (
    accountId: number,
    operationId: number,
    payload: { amount: number; fees: number; social_fees?: number; date: string },
  ) =>
    request<InsuranceOperation>(
      'PUT',
      `/api/insurance/${accountId}/operations/${operationId}`,
      payload,
    ),
  positions: (accountId: number) =>
    request<InsuranceSupportView[]>('GET', `/api/insurance/${accountId}/positions`),
  operations: (accountId: number) =>
    request<InsuranceOperation[]>('GET', `/api/insurance/${accountId}/operations`),
  versement: (accountId: number, payload: InsuranceFlowPayload) =>
    request<{ operation: InsuranceOperation; transaction_id: number }>(
      'POST',
      `/api/insurance/${accountId}/versement`,
      payload,
    ),
  rachat: (accountId: number, payload: InsuranceFlowPayload) =>
    request<{ operation: InsuranceOperation; transaction_id: number }>(
      'POST',
      `/api/insurance/${accountId}/rachat`,
      payload,
    ),
  arbitrage: (accountId: number, payload: ArbitragePayload) =>
    request<{ outOperation: InsuranceOperation; inOperation: InsuranceOperation }>(
      'POST',
      `/api/insurance/${accountId}/arbitrage`,
      payload,
    ),
  interets: (accountId: number, payload: InteretsPayload) =>
    request<{ operation: InsuranceOperation; transaction_id: number }>(
      'POST',
      `/api/insurance/${accountId}/interets`,
      payload,
    ),
  revaloriser: (accountId: number, payload: RevaloriserPayload) =>
    request<{ operation: InsuranceOperation }>(
      'POST',
      `/api/insurance/${accountId}/revalorisation`,
      payload,
    ),
};

// Tax
export const taxApi = {
  years: () => request<number[]>('GET', '/api/tax/years'),
  yearData: (year: number) => request<TaxYearData>('GET', `/api/tax/${year}`),
};

// Stats
export const statsApi = {
  dashboard: () => request<DashboardStats>('GET', '/api/stats'),
  balanceHistory: () => request<BalanceHistoryData>('GET', '/api/stats/balance-history'),
  profitability: () => request<AccountProfitability[]>('GET', '/api/stats/profitability'),
  reportYears: () => request<number[]>('GET', '/api/stats/report-years'),
  report: (params: { year: number; account_id?: number }) => {
    const qs = new URLSearchParams({ year: String(params.year) });
    if (params.account_id != null) qs.set('account_id', String(params.account_id));
    return request<ReportData>('GET', `/api/stats/report?${qs.toString()}`);
  },
};

// Loans
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
  recent: () => request<PendingReimbursement[]>('GET', '/api/reimbursements/recent'),
  list: (transactionId: number) =>
    request<Reimbursement[]>('GET', `/api/reimbursements/${transactionId}`),
  link: (transactionId: number, linked_transaction_id: number, attributed_amount?: number) =>
    request<Reimbursement[]>('POST', `/api/reimbursements/${transactionId}`, {
      linked_transaction_id,
      ...(attributed_amount != null && { attributed_amount }),
    }),
  updateAmount: (transactionId: number, linkedId: number, attributed_amount: number | null) =>
    request<Reimbursement[]>('PATCH', `/api/reimbursements/${transactionId}/${linkedId}`, {
      attributed_amount,
    }),
  unlink: (transactionId: number, linkedId: number) =>
    request<{ ok: boolean }>('DELETE', `/api/reimbursements/${transactionId}/${linkedId}`),
  setStatus: (transactionId: number, reimbursement_status: 'en_attente' | 'rembourse' | null) =>
    request<Transaction>('PATCH', `/api/reimbursements/${transactionId}/status`, {
      reimbursement_status,
    }),
};

// Import
export const importApi = {
  executeStructured: (body: ImportExecuteBody) =>
    request<ImportResult>('POST', '/api/import/structured', body),
  executeJsonFull: (body: unknown) =>
    request<JsonFullImportResult>('POST', '/api/import/json-full', body),
};

// Transactions
function buildTransactionUrl(filters?: TransactionFilters): string {
  const params = new URLSearchParams();
  if (filters?.account_id != null) params.set('account_id', String(filters.account_id));
  if (filters?.type != null) params.set('type', filters.type);
  if (filters?.category_id != null) params.set('category_id', String(filters.category_id));
  if (filters?.subcategory_id != null) params.set('subcategory_id', String(filters.subcategory_id));
  if (filters?.description_contains)
    params.set('description_contains', filters.description_contains);
  if (filters?.date_from) params.set('date_from', filters.date_from);
  if (filters?.date_to) params.set('date_to', filters.date_to);
  if (filters?.amount_min != null) params.set('amount_min', String(filters.amount_min));
  if (filters?.amount_max != null) params.set('amount_max', String(filters.amount_max));
  if (filters?.payment_method_id != null)
    params.set('payment_method_id', String(filters.payment_method_id));
  if (filters?.validated != null) params.set('validated', String(filters.validated));
  if (filters?.scheduled_id != null) params.set('scheduled_id', String(filters.scheduled_id));
  if (filters?.exclude_linked_reimbursements) params.set('exclude_linked_reimbursements', 'true');
  if (filters?.page != null) params.set('page', String(filters.page));
  if (filters?.limit != null) params.set('limit', String(filters.limit));
  return ['/api/transactions', params.toString()].filter(Boolean).join('?');
}

export const transactionsApi = {
  list: (filters?: TransactionFilters) =>
    request<PaginatedTransactions>('GET', buildTransactionUrl(filters)),
  create: (payload: CreateTransactionPayload) =>
    request<Transaction>('POST', '/api/transactions', payload),
  update: (id: number, payload: UpdateTransactionPayload) =>
    request<Transaction>('PUT', `/api/transactions/${id}`, payload),
  validate: (id: number, validated: boolean) =>
    request<Transaction>('PATCH', `/api/transactions/${id}/validate`, { validated }),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/transactions/${id}`),
};

// Categorization rules
export interface CategorizationRule {
  id: number;
  user_id: number;
  pattern: string;
  subcategory_id: number;
  sort_order: number;
}

export const categorizationRulesApi = {
  list: () => request<CategorizationRule[]>('GET', '/api/categorization-rules'),
  match: (description: string) =>
    request<CategorizationRule | null>(
      'GET',
      `/api/categorization-rules/match?description=${encodeURIComponent(description)}`,
    ),
  create: (pattern: string, subcategoryId: number) =>
    request<CategorizationRule>('POST', '/api/categorization-rules', {
      pattern,
      subcategory_id: subcategoryId,
    }),
  update: (id: number, pattern: string, subcategoryId: number) =>
    request<CategorizationRule>('PUT', `/api/categorization-rules/${id}`, {
      pattern,
      subcategory_id: subcategoryId,
    }),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/categorization-rules/${id}`),
  removeAll: () => request<{ deleted: number }>('DELETE', '/api/categorization-rules'),
  initFromHistory: () =>
    request<{ inserted: number }>('POST', '/api/categorization-rules/init-from-history'),
};
