import type { TransactionFilters } from '@cashctrl/types';

export const queryKeys = {
  accounts: () => ['accounts'] as const,
  accountTypes: () => ['account-types'] as const,
  banks: () => ['banks'] as const,
  categories: () => ['categories'] as const,
  paymentMethods: () => ['payment-methods'] as const,
  scheduled: () => ['scheduled'] as const,
  settings: () => ['settings'] as const,
  users: () => ['users'] as const,
  me: () => ['me'] as const,
  version: () => ['version'] as const,
  dashboardStats: () => ['dashboard-stats'] as const,
  balanceHistory: () => ['balance-history'] as const,
  profitability: () => ['profitability'] as const,
  reportYears: () => ['report-years'] as const,
  report: (year: number, accountId?: number) => ['report', year, accountId] as const,

  transactions: {
    all: () => ['transactions'] as const,
    list: (filters?: TransactionFilters) => ['transactions', filters] as const,
  },

  stocks: {
    positions: {
      all: () => ['stock-positions'] as const,
      byAccount: (accountId: number) => ['stock-positions', accountId] as const,
    },
    operations: (accountId: number) => ['stock-operations', accountId] as const,
    search: (query: string) => ['stock-search', query] as const,
  },

  insurance: {
    all: () => ['insurance'] as const,
    positions: (accountId: number) => ['insurance', 'positions', accountId] as const,
    operations: (accountId: number) => ['insurance', 'operations', accountId] as const,
    supports: (accountId: number) => ['insurance', 'supports', accountId] as const,
  },

  loans: {
    all: () => ['loans'] as const,
    byAccount: (accountId: number) => ['loans', 'account', accountId] as const,
    installments: (loanId: number | undefined) => ['loans', 'installments', loanId] as const,
  },

  reimbursements: {
    all: () => ['reimbursements'] as const,
    byTransaction: (transactionId: number) => ['reimbursements', transactionId] as const,
    pending: () => ['reimbursements', 'pending'] as const,
    recent: () => ['reimbursements', 'recent'] as const,
  },

  tax: {
    all: () => ['tax'] as const,
    years: () => ['tax', 'years'] as const,
    year: (year: number | undefined) => ['tax', 'year', year] as const,
  },

  categorizationRules: {
    all: () => ['categorization-rules'] as const,
    match: (description: string) => ['categorization-rules', 'match', description] as const,
  },
};
