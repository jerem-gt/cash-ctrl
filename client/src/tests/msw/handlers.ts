import { http, HttpResponse } from 'msw';

import {
  ACCOUNT_TYPES,
  ACCOUNTS,
  BANKS,
  CATEGORIES,
  IMPORT_RESULT,
  INSURANCE_OPERATIONS,
  INSURANCE_POSITIONS,
  LOAN,
  LOAN_INSTALLMENTS,
  PAYMENT_METHODS,
  PENDING_REIMBURSEMENTS,
  PROFITABILITY_DATA,
  RECENT_REIMBURSEMENTS,
  REIMBURSEMENTS,
  REPORT_DATA,
  REPORT_YEARS,
  SCHEDULED,
  STOCK_OPERATIONS,
  STOCK_POSITIONS,
  STOCK_SEARCH_RESULTS,
  SUBCATEGORIES,
  TAX_YEAR_DATA_2025,
  TAX_YEAR_DATA_2026,
  TAX_YEARS,
  TRANSACTIONS,
  USERS,
} from '../fixtures';

export const handlers = [
  // Auth
  http.get('/api/auth/me', () =>
    HttpResponse.json({ username: 'test', isAdmin: false, totpEnabled: false }),
  ),
  http.post('/api/auth/login', () =>
    HttpResponse.json({ username: 'test', isAdmin: false, totpEnabled: false }),
  ),
  http.post('/api/auth/logout', () => HttpResponse.json({ ok: true })),
  http.post('/api/auth/change-password', () => HttpResponse.json({ ok: true })),
  http.post('/api/auth/2fa/setup', () =>
    HttpResponse.json({
      uri: 'otpauth://totp/CashCtrl:test?secret=BASE32SECRET&issuer=CashCtrl',
      secret: 'BASE32SECRET',
    }),
  ),
  http.post('/api/auth/2fa/enable', () => HttpResponse.json({ ok: true })),
  http.post('/api/auth/2fa/disable', () => HttpResponse.json({ ok: true })),
  http.post('/api/auth/2fa/verify', () =>
    HttpResponse.json({ username: 'test', isAdmin: false, totpEnabled: true }),
  ),

  // Users (admin)
  http.get('/api/users', () => HttpResponse.json(USERS)),
  http.post('/api/users', () =>
    HttpResponse.json(
      { id: 99, username: 'newuser', is_admin: 0, created_at: '2026-01-01' },
      { status: 201 },
    ),
  ),
  http.patch('/api/users/:id', () => HttpResponse.json({ ...USERS[1], username: 'updated' })),
  http.delete('/api/users/:id', () => HttpResponse.json({ ok: true })),

  // Version
  http.get('/api/version', () => HttpResponse.json({ version: 'development' })),

  // Accounts
  http.get('/api/accounts', () => HttpResponse.json(ACCOUNTS)),
  http.post('/api/accounts', () => HttpResponse.json({ ...ACCOUNTS[0], id: 99, name: 'Nouveau' })),
  http.put('/api/accounts/:id', () => HttpResponse.json(ACCOUNTS[0])),
  http.delete('/api/accounts/:id', () => HttpResponse.json({ ok: true })),
  http.post('/api/accounts/:id/close', () =>
    HttpResponse.json({ ...ACCOUNTS[0], closed_at: '2025-01-01' }),
  ),
  http.post('/api/accounts/:id/reopen', () =>
    HttpResponse.json({ ...ACCOUNTS[0], closed_at: null }),
  ),

  // Account types
  http.get('/api/account-types', () => HttpResponse.json(ACCOUNT_TYPES)),
  http.post('/api/account-types', () => HttpResponse.json({ id: 99, name: 'Nouveau type' })),
  http.put('/api/account-types/:id', () => HttpResponse.json(ACCOUNT_TYPES[0])),
  http.delete('/api/account-types/:id', () => HttpResponse.json({ ok: true })),

  // Banks
  http.get('/api/banks', () => HttpResponse.json(BANKS)),
  http.post('/api/banks', () =>
    HttpResponse.json({ id: 99, name: 'Nouvelle banque', logo: null, domain: null, sort_order: 1 }),
  ),
  http.put('/api/banks/reorder', () => HttpResponse.json({ ok: true })),
  http.put('/api/banks/:id', () => HttpResponse.json(BANKS[0])),
  http.delete('/api/banks/:id', () => HttpResponse.json({ ok: true })),

  // Categories
  http.get('/api/categories', () => HttpResponse.json(CATEGORIES)),
  http.post('/api/categories', () => HttpResponse.json({ id: 99, name: 'Nouvelle cat' })),
  http.put('/api/categories/:id', () => HttpResponse.json(CATEGORIES[0])),
  http.delete('/api/categories/:id', () => HttpResponse.json({ ok: true })),

  // Subcategories
  http.post('/api/subcategories', () =>
    HttpResponse.json({ id: 99, name: 'Nouvelle subcat', category_id: 99 }),
  ),
  http.put('/api/subcategories/:id', () => HttpResponse.json(SUBCATEGORIES[0])),
  http.delete('/api/subcategories/:id', () => HttpResponse.json({ ok: true })),

  // Payment methods
  http.get('/api/payment-methods', () => HttpResponse.json(PAYMENT_METHODS)),
  http.post('/api/payment-methods', () =>
    HttpResponse.json({ id: 99, name: 'Nouveau PM', icon: '💰' }),
  ),
  http.put('/api/payment-methods/:id', () => HttpResponse.json(PAYMENT_METHODS[0])),
  http.delete('/api/payment-methods/:id', () => HttpResponse.json({ ok: true })),

  // Transactions
  http.get('/api/transactions', () => HttpResponse.json(TRANSACTIONS)),
  http.post('/api/transactions', () => HttpResponse.json(TRANSACTIONS.data[0])),
  http.put('/api/transactions/:id', () => HttpResponse.json(TRANSACTIONS.data[0])),
  http.patch('/api/transactions/:id/validate', () =>
    HttpResponse.json({ ...TRANSACTIONS.data[0], validated: 1 }),
  ),
  http.delete('/api/transactions/:id', () => HttpResponse.json({ ok: true })),

  // Transfers
  http.post('/api/transfers', () =>
    HttpResponse.json({ expense: TRANSACTIONS.data[0], income: TRANSACTIONS.data[0] }),
  ),
  http.put('/api/transfers/:id', () => HttpResponse.json(TRANSACTIONS.data[0])),
  http.delete('/api/transfers/:id', () => HttpResponse.json({ ok: true })),

  // Scheduled
  http.get('/api/scheduled', () => HttpResponse.json(SCHEDULED)),
  http.post('/api/scheduled', () => HttpResponse.json({ ...SCHEDULED[0], id: 99 })),
  http.put('/api/scheduled/:id', () => HttpResponse.json(SCHEDULED[0])),
  http.delete('/api/scheduled/:id', () => HttpResponse.json({ ok: true })),

  // Settings
  http.patch('/api/settings/system-refs', () =>
    HttpResponse.json({
      lead_days: 3,
      backup_enabled: false,
      backup_frequency_h: 24,
      backup_max_files: 7,
      backup_last_at: null,
      financial_income_category_id: 1,
      transfer_subcategory_id: null,
      transfer_payment_method_id: null,
      bank_fees_subcategory_id: null,
      social_fees_subcategory_id: null,
      prelevement_payment_method_id: null,
    }),
  ),
  http.get('/api/settings', () =>
    HttpResponse.json({
      lead_days: 3,
      backup_enabled: false,
      backup_frequency_h: 24,
      backup_max_files: 7,
      backup_last_at: null,
      financial_income_category_id: null,
      transfer_subcategory_id: null,
      transfer_payment_method_id: null,
      bank_fees_subcategory_id: null,
      social_fees_subcategory_id: null,
      prelevement_payment_method_id: null,
    }),
  ),
  http.put('/api/settings', () =>
    HttpResponse.json({
      lead_days: 30,
      backup_enabled: false,
      backup_frequency_h: 24,
      backup_max_files: 7,
      backup_last_at: null,
      financial_income_category_id: null,
      transfer_subcategory_id: null,
      transfer_payment_method_id: null,
      bank_fees_subcategory_id: null,
      social_fees_subcategory_id: null,
      prelevement_payment_method_id: null,
    }),
  ),

  // Backup
  http.get('/api/backup/list', () =>
    HttpResponse.json([
      {
        filename: 'cashctrl-backup-2026-05-14T10-00-00.json',
        size: 1024,
        created_at: '2026-05-14T10:00:00Z',
      },
    ]),
  ),
  http.post('/api/backup/run', () =>
    HttpResponse.json(
      { skipped: false, filename: 'cashctrl-backup-2026-05-14T10-30-00-000.json' },
      { status: 201 },
    ),
  ),

  // Reimbursements
  http.get('/api/reimbursements/pending', () => HttpResponse.json(PENDING_REIMBURSEMENTS)),
  http.get('/api/reimbursements/recent', () => HttpResponse.json(RECENT_REIMBURSEMENTS)),
  http.get('/api/reimbursements/:transactionId', () => HttpResponse.json(REIMBURSEMENTS)),
  http.post('/api/reimbursements/:transactionId', () =>
    HttpResponse.json(REIMBURSEMENTS, { status: 201 }),
  ),
  http.patch('/api/reimbursements/:transactionId/status', () =>
    HttpResponse.json({ ...TRANSACTIONS.data[0], reimbursement_status: 'en_attente' }),
  ),
  http.patch('/api/reimbursements/:transactionId/:linkedId', () =>
    HttpResponse.json(REIMBURSEMENTS),
  ),
  http.delete('/api/reimbursements/:transactionId/:linkedId', () =>
    HttpResponse.json({ ok: true }),
  ),

  // Import
  http.post('/api/import/qif', () => HttpResponse.json(IMPORT_RESULT, { status: 201 })),
  http.post('/api/import/json-full', () =>
    HttpResponse.json(
      { accounts: 1, transactions: 5, transfers: 2, scheduled: 0, stockOperations: 0, loans: 0 },
      { status: 201 },
    ),
  ),

  // Export
  http.get(
    '/api/export/json-full',
    () => new HttpResponse(new Blob(['{}'], { type: 'application/json' })),
  ),

  // Loans (specific patterns before generic /:loanId)
  http.get('/api/loans/account/:accountId', () => HttpResponse.json(LOAN)),
  http.get('/api/loans/:loanId/installments', () => HttpResponse.json(LOAN_INSTALLMENTS)),
  http.post('/api/loans', () => HttpResponse.json(LOAN, { status: 201 })),
  http.patch('/api/loans/:loanId/installments/:installmentId', () =>
    HttpResponse.json(LOAN_INSTALLMENTS[0]),
  ),
  http.patch('/api/loans/:loanId', () => HttpResponse.json(LOAN)),

  // Insurance
  http.get('/api/insurance/:accountId/supports', () => HttpResponse.json([])),
  http.post('/api/insurance/:accountId/supports', () =>
    HttpResponse.json(
      {
        id: 99,
        account_id: 10,
        name: 'Nouveau support',
        type: 'euro',
        ticker: null,
        created_at: '2024-01-01',
      },
      { status: 201 },
    ),
  ),
  http.delete('/api/insurance/:accountId/supports/:supportId', () =>
    HttpResponse.json({ ok: true }),
  ),
  http.put('/api/insurance/:accountId/operations/:operationId', () =>
    HttpResponse.json({ ...INSURANCE_OPERATIONS[0], amount: 2000 }),
  ),
  http.delete('/api/insurance/:accountId/operations/:operationId', () =>
    HttpResponse.json({ ok: true }),
  ),
  http.get('/api/insurance/:accountId/positions', () => HttpResponse.json(INSURANCE_POSITIONS)),
  http.get('/api/insurance/:accountId/operations', () => HttpResponse.json(INSURANCE_OPERATIONS)),
  http.post('/api/insurance/:accountId/versement', () =>
    HttpResponse.json({ operation: INSURANCE_OPERATIONS[0], transaction_id: 101 }, { status: 201 }),
  ),
  http.post('/api/insurance/:accountId/rachat', () =>
    HttpResponse.json(
      { operation: { ...INSURANCE_OPERATIONS[0], type: 'rachat' }, transaction_id: 102 },
      { status: 201 },
    ),
  ),
  http.post('/api/insurance/:accountId/arbitrage', () =>
    HttpResponse.json(
      {
        outOperation: { ...INSURANCE_OPERATIONS[0], type: 'arbitrage_out' },
        inOperation: { ...INSURANCE_OPERATIONS[0], id: 2, type: 'arbitrage_in' },
      },
      { status: 201 },
    ),
  ),
  http.post('/api/insurance/:accountId/interets', () =>
    HttpResponse.json(
      { operation: { ...INSURANCE_OPERATIONS[0], type: 'interets' }, transaction_id: 103 },
      { status: 201 },
    ),
  ),
  http.post('/api/insurance/:accountId/revalorisation', () =>
    HttpResponse.json(
      { operation: { ...INSURANCE_OPERATIONS[0], type: 'revalorisation', amount: 150 } },
      { status: 201 },
    ),
  ),

  // Tax
  http.get('/api/tax/years', () => HttpResponse.json(TAX_YEARS)),
  http.get('/api/tax/:year', ({ params }) => {
    if (String(params.year) === '2026') return HttpResponse.json(TAX_YEAR_DATA_2026);
    if (String(params.year) === '2025') return HttpResponse.json(TAX_YEAR_DATA_2025);
    return HttpResponse.json({ error: 'Barème introuvable' }, { status: 404 });
  }),

  // Stats
  http.get('/api/stats', () =>
    HttpResponse.json({
      month_income: 0,
      month_expense: 0,
      monthly: [],
      expenses_by_category: [],
      recent: [],
      to_validate: [],
      upcoming: [],
    }),
  ),
  http.get('/api/stats/balance-history', () => HttpResponse.json({ account_types: [], data: [] })),
  http.get('/api/stats/profitability', () => HttpResponse.json(PROFITABILITY_DATA)),
  http.get('/api/stats/report-years', () => HttpResponse.json(REPORT_YEARS)),
  http.get('/api/stats/report', () => HttpResponse.json(REPORT_DATA)),

  // Stocks
  http.get('/api/stocks/:accountId/positions', () => HttpResponse.json(STOCK_POSITIONS)),
  http.get('/api/stocks/:accountId/operations', () => HttpResponse.json(STOCK_OPERATIONS)),
  http.post('/api/stocks/:accountId/buy', () =>
    HttpResponse.json({ operation: STOCK_OPERATIONS[0], transaction_id: 20 }, { status: 201 }),
  ),
  http.post('/api/stocks/:accountId/sell', () =>
    HttpResponse.json(
      { operation: { ...STOCK_OPERATIONS[0], type: 'sell' }, transaction_id: 21 },
      { status: 201 },
    ),
  ),
  http.put('/api/stocks/:accountId/operations/:operationId', () =>
    HttpResponse.json(STOCK_OPERATIONS[0]),
  ),
  http.get('/api/stocks/price/:ticker', () =>
    HttpResponse.json({
      ticker: 'DCAM.PA',
      price: 15,
      currency: 'EUR',
      fetched_at: '2026-05-01T10:00:00',
    }),
  ),
  http.post('/api/stocks/prices/refresh', () => HttpResponse.json({ ok: true })),
  http.post('/api/stocks/:accountId/transfer', () =>
    HttpResponse.json(
      {
        outOperation: { ...STOCK_OPERATIONS[0], type: 'transfer_out' },
        inOperation: { ...STOCK_OPERATIONS[0], id: 2, account_id: 5, type: 'transfer_in' },
      },
      { status: 201 },
    ),
  ),
  http.get('/api/stocks/search', () => HttpResponse.json(STOCK_SEARCH_RESULTS)),
];
