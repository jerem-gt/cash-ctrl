import { ImportResult } from '@/api/client.ts';
import type {
  Account,
  AccountProfitability,
  AccountType,
  Bank,
  Category,
  InsuranceOperation,
  InsuranceSupportView,
  Loan,
  LoanInstallment,
  PaginatedTransactions,
  PaymentMethod,
  PendingReimbursement,
  Reimbursement,
  ScheduledTransaction,
  StockOperation,
  StockPosition,
  Subcategory,
  TaxYearData,
  Transaction,
  UserPublic,
} from '@/types';

export const USERS: UserPublic[] = [
  {
    id: 1,
    username: 'admin',
    is_admin: 1,
    created_at: '2025-01-01T00:00:00',
    account_count: 0,
    tx_count: 0,
    last_tx_date: null,
  },
  {
    id: 2,
    username: 'alice',
    is_admin: 0,
    created_at: '2025-06-01T00:00:00',
    account_count: 3,
    tx_count: 47,
    last_tx_date: '2026-05-15',
  },
];

export const TAX_YEARS: number[] = [2026, 2025, 2024];

export const TAX_YEAR_DATA_2025: TaxYearData = {
  year: 2025,
  params: {
    year: 2025,
    abattement_rate: 0.1,
    abattement_min: 495,
    abattement_max: 14171,
    pass: 47100,
    created_at: '2025-01-01',
  },
  brackets: [
    { id: 1, year: 2025, min_income: 0, max_income: 11497, rate: 0, created_at: '' },
    { id: 2, year: 2025, min_income: 11497, max_income: 29315, rate: 11, created_at: '' },
    { id: 3, year: 2025, min_income: 29315, max_income: 83823, rate: 30, created_at: '' },
    { id: 4, year: 2025, min_income: 83823, max_income: 180294, rate: 41, created_at: '' },
    { id: 5, year: 2025, min_income: 180294, max_income: null, rate: 45, created_at: '' },
  ],
};

export const TAX_YEAR_DATA_2026: TaxYearData = {
  year: 2026,
  params: {
    year: 2026,
    abattement_rate: 0.1,
    abattement_min: 509,
    abattement_max: 14555,
    pass: 48060,
    created_at: '2026-01-01',
  },
  brackets: [
    { id: 6, year: 2026, min_income: 0, max_income: 11600, rate: 0, created_at: '' },
    { id: 7, year: 2026, min_income: 11600, max_income: 29579, rate: 11, created_at: '' },
    { id: 8, year: 2026, min_income: 29579, max_income: 84577, rate: 30, created_at: '' },
    { id: 9, year: 2026, min_income: 84577, max_income: 181917, rate: 41, created_at: '' },
    { id: 10, year: 2026, min_income: 181917, max_income: null, rate: 45, created_at: '' },
  ],
};

export const ACCOUNTS: Account[] = [
  {
    id: 1,
    name: 'Compte test',
    bank_id: 1,
    bank: 'BNP',
    account_type_id: 1,
    type: 'Courant',
    envelope_type: null,
    initial_balance: 0,
    opening_date: '2024-01-01',
    closed_at: null,
    balance: 1500,
    balance_stocks: 0,
    balance_insurance: 0,
    balance_all: 1500,
    capital_restant_du: null,
    capital_restant_du_all: null,
  },
  {
    id: 2,
    name: 'Livret A',
    bank: 'LCL',
    bank_id: 2,
    account_type_id: 1,
    type: 'Livret',
    envelope_type: null,
    initial_balance: 0,
    opening_date: null,
    closed_at: null,
    balance: 500,
    balance_stocks: 0,
    balance_insurance: 0,
    balance_all: 0,
    capital_restant_du: null,
    capital_restant_du_all: null,
  },
  {
    id: 10,
    name: 'AV Suravenir',
    bank: 'Suravenir',
    bank_id: 3,
    account_type_id: 4,
    type: 'Assurance Vie',
    envelope_type: 'life_insurance',
    initial_balance: 0,
    opening_date: '2024-01-01',
    closed_at: null,
    balance: -6073.55,
    balance_stocks: 0,
    balance_insurance: 6073.55,
    balance_all: -6073.55,
    capital_restant_du: null,
    capital_restant_du_all: null,
  },
];

export const INVESTMENT_ACCOUNT: Account = {
  id: 3,
  name: 'PEA',
  bank_id: 1,
  bank: 'BNP',
  account_type_id: 3,
  type: 'Bourse',
  envelope_type: 'investment',
  initial_balance: 0,
  opening_date: '2024-01-01',
  closed_at: null,
  balance: 0,
  balance_stocks: 3000,
  balance_insurance: 0,
  balance_all: 3000,
  capital_restant_du: null,
  capital_restant_du_all: null,
};

export const INVESTMENT_ACCOUNT_2: Account = {
  id: 5,
  name: 'CTO',
  bank_id: 1,
  bank: 'BNP',
  account_type_id: 3,
  type: 'Bourse',
  envelope_type: 'investment',
  initial_balance: 0,
  opening_date: '2024-01-01',
  closed_at: null,
  balance: 0,
  balance_stocks: 1500,
  balance_insurance: 0,
  balance_all: 1500,
  capital_restant_du: null,
  capital_restant_du_all: null,
};

export const STOCK_SEARCH_RESULTS = [
  { symbol: 'DCAM.PA', name: 'Décathlon SA', exchange: 'Paris', type: 'EQUITY' },
  { symbol: 'DCAM.DE', name: 'Decathlon', exchange: 'XETRA', type: 'EQUITY' },
];

export const ACCOUNT_TYPES: AccountType[] = [
  { id: 1, name: 'Courant', envelope_type: null, acc_count: 1 },
  { id: 3, name: 'Bourse', envelope_type: 'investment', acc_count: 1 },
  { id: 4, name: 'Assurance Vie', envelope_type: 'life_insurance', acc_count: 0 },
];

export const INSURANCE_POSITIONS: InsuranceSupportView[] = [
  {
    id: 1,
    account_id: 10,
    name: 'Fonds Euro Sécurité',
    type: 'euro',
    ticker: null,
    value: 5000,
  },
  {
    id: 2,
    account_id: 10,
    name: 'Amundi MSCI World',
    type: 'uc',
    ticker: 'LU1681043599.SW',
    value: 1073.55,
  },
];

export const INSURANCE_OPERATIONS: InsuranceOperation[] = [
  {
    id: 1,
    account_id: 10,
    support_id: 1,
    support_name: 'Fonds Euro Sécurité',
    support_type: 'euro',
    transaction_id: 100,
    fees_transaction_id: null,
    social_fees_transaction_id: null,
    type: 'versement',
    amount: 5000,
    fees: 0,
    social_fees: 0,
    date: '2024-01-15',
    arbitrage_peer_id: null,
    created_at: '2024-01-15T10:00:00',
    from_scheduled: false,
  },
  {
    id: 2,
    account_id: 10,
    support_id: 1,
    support_name: 'Fonds Euro Sécurité',
    support_type: 'euro',
    transaction_id: 101,
    fees_transaction_id: null,
    social_fees_transaction_id: null,
    type: 'versement',
    amount: 200,
    fees: 0,
    social_fees: 0,
    date: '2024-02-01',
    arbitrage_peer_id: null,
    created_at: '2024-02-01T10:00:00',
    from_scheduled: true,
  },
];

export const STOCK_POSITIONS: StockPosition[] = [
  {
    id: 1,
    account_id: 3,
    ticker: 'DCAM.PA',
    quantity: 10,
    avg_price: 12,
    current_price: 15,
    currency: 'EUR',
    name: 'Décathlon',
    price_fetched_at: '2026-05-01T10:00:00',
    updated_at: '2026-05-01T10:00:00',
    created_at: '2026-04-01T10:00:00',
  },
];

export const STOCK_OPERATIONS: StockOperation[] = [
  {
    id: 1,
    account_id: 3,
    transaction_id: 20,
    fees_transaction_id: null,
    ticker: 'DCAM.PA',
    type: 'buy',
    quantity: 10,
    price_per_share: 12,
    fees: 1.5,
    date: '2026-04-01',
    transfer_peer_id: null,
    created_at: '2026-04-01T10:00:00',
  },
];

export const BANKS: Bank[] = [
  { id: 1, name: 'BNP', logo: 'image-qui-n-existe-pas.png', domain: 'bnp.fr', sort_order: 0 },
];

export const CATEGORIES: Category[] = [
  {
    id: 1,
    name: 'Alimentation',
    icon: '🍴',
    subcategories: [{ id: 1, name: 'Supermarché' }],
  },
  {
    id: 2,
    name: 'Logement',
    icon: '🏠',
    subcategories: [{ id: 2, name: 'Loyer' }],
  },
];

export const SUBCATEGORIES: Subcategory[] = [
  {
    id: 1,
    name: 'Supermarché',
  },
];

export const PAYMENT_METHODS: PaymentMethod[] = [{ id: 1, name: 'CB', icon: '💳' }];

export const STOCK_TX: Transaction = {
  id: 20,
  account_id: 3,
  type: 'expense',
  amount: 121.5,
  description: 'Achat 10 × DCAM.PA',
  category_id: 0,
  subcategory_id: null,
  category: '',
  subcategory: '',
  date: '2026-04-01',
  transfer_peer_id: null,
  scheduled_id: null,
  validated: 0,
  payment_method_id: null,
  payment_method: '',
  notes: null,
  reimbursement_status: null,
  loan_principal: null,
  stock_operation: STOCK_OPERATIONS[0],
};

export const TRANSACTIONS: PaginatedTransactions = {
  data: [
    {
      id: 10,
      account_id: 1,
      type: 'expense',
      amount: 24.5,
      description: 'Courses',
      category_id: 1,
      subcategory_id: 1,
      category: 'Alimentation',
      subcategory: 'Supermarché',
      date: '2026-04-20',
      transfer_peer_id: null,
      scheduled_id: null,
      validated: 1,
      payment_method_id: 1,
      payment_method: 'CB',
      notes: null,
      reimbursement_status: null,
      loan_principal: null,
    },
  ],
  total: 1,
  page: 1,
  totalPages: 1,
};

export const SCHEDULED: ScheduledTransaction[] = [
  {
    id: 1,
    account_id: 1,
    to_account_id: null,
    type: 'expense',
    amount: 800,
    description: 'Loyer',
    category_id: 1,
    subcategory_id: 1,
    category: 'Logement',
    subcategory: 'Loyer',
    payment_method_id: 1,
    payment_method: 'Virement',
    insurance_support_id: null,
    insurance_fees: 0,
    insurance_support_name: '',
    notes: null,
    recurrence_unit: 'month',
    recurrence_interval: 1,
    recurrence_day: 1,
    recurrence_month: null,
    weekend_handling: 'allow',
    start_date: '2024-01-01',
    end_date: null,
    active: 1,
    account_name: 'Compte courant',
    transaction_count: 3,
  },
];

export const REIMBURSEMENTS: Reimbursement[] = [
  {
    id: 20,
    amount: 45,
    transaction_amount: 90,
    description: 'Remboursement CPAM',
    date: '2026-04-22',
    subcategory: 'CPAM',
    category: 'Santé',
    payment_method: 'Virement',
  },
];

export const PENDING_REIMBURSEMENTS: PendingReimbursement[] = [
  {
    id: 10,
    amount: 150,
    description: 'Médecin',
    date: '2026-04-20',
    subcategory: 'Médecin',
    category: 'Santé',
    account_name: 'Compte test',
    total_reimbursed: 45,
  },
];

export const RECENT_REIMBURSEMENTS: PendingReimbursement[] = [
  {
    id: 11,
    amount: 80,
    description: 'Pharmacie',
    date: '2026-02-10',
    subcategory: 'Pharmacie',
    category: 'Santé',
    account_name: 'Compte test',
    total_reimbursed: 80,
  },
];

export const LOAN_ACCOUNT: Account = {
  id: 10,
  name: 'Prêt immobilier',
  bank_id: 1,
  bank: 'BNP',
  account_type_id: 5,
  type: 'Prêt',
  envelope_type: 'loan',
  initial_balance: -12000,
  opening_date: '2024-01-01',
  closed_at: null,
  balance: -11200,
  balance_stocks: 0,
  balance_insurance: 0,
  balance_all: 0,
  capital_restant_du: 11200,
  capital_restant_du_all: 11200,
};

export const LOAN: Loan = {
  id: 1,
  account_id: 10,
  user_id: 1,
  principal_amount: 12000,
  interest_rate: 0.05,
  duration_months: 36,
  start_date: '2024-02-01',
  monthly_payment: 359.61,
  source_account_id: 1,
  deposit_account_id: 2,
  created_at: '2024-01-01T00:00:00',
};

export const LOAN_INSTALLMENTS: LoanInstallment[] = [
  {
    id: 101,
    loan_id: 1,
    installment_number: 1,
    due_date: '2024-02-01',
    total_amount: 359.61,
    principal_amount: 309.61,
    interest_amount: 50,
    transaction_id: null,
    transaction_validated: null,
  },
  {
    id: 102,
    loan_id: 1,
    installment_number: 2,
    due_date: '2024-03-01',
    total_amount: 359.61,
    principal_amount: 310.9,
    interest_amount: 48.71,
    transaction_id: 30,
    transaction_validated: 1,
  },
  {
    id: 103,
    loan_id: 1,
    installment_number: 3,
    due_date: '2024-04-01',
    total_amount: 359.61,
    principal_amount: 312.19,
    interest_amount: 47.42,
    transaction_id: 31,
    transaction_validated: 0,
  },
];

export const IMPORT_RESULT: ImportResult = {
  transactions: 3,
  transfers: 4,
};

export const PROFITABILITY_DATA: AccountProfitability[] = [
  {
    account_id: 3,
    account_name: 'PEA',
    envelope_type: 'investment',
    account_type: 'Bourse',
    opening_date: '2022-01-01',
    capital_investi: 10000,
    capital_retire: 0,
    valeur_actuelle: 13500,
    plus_value_absolue: 3500,
    rendement_total_pct: 35,
    rendement_annualise_pct: 10.67,
    yearly_returns: [
      {
        year: '2022',
        start_value: 0,
        end_value: 10350,
        net_flows: 10000,
        gain: 350,
        return_pct: null,
        is_ytd: false,
      },
      {
        year: '2023',
        start_value: 10350,
        end_value: 12500,
        net_flows: 0,
        gain: 2150,
        return_pct: 20.77,
        is_ytd: false,
      },
    ],
  },
  {
    account_id: 4,
    account_name: 'Assurance Vie',
    envelope_type: 'life_insurance',
    account_type: 'Assurance Vie',
    opening_date: '2021-06-01',
    capital_investi: 50000,
    capital_retire: 0,
    valeur_actuelle: 54200,
    plus_value_absolue: 4200,
    rendement_total_pct: 8.4,
    rendement_annualise_pct: 2.09,
    yearly_returns: [],
  },
  {
    account_id: 5,
    account_name: 'Livret A',
    envelope_type: 'savings',
    account_type: 'Épargne',
    opening_date: '2020-01-01',
    capital_investi: 3000,
    capital_retire: 0,
    valeur_actuelle: 3180,
    plus_value_absolue: 180,
    rendement_total_pct: 6,
    rendement_annualise_pct: 1.17,
    yearly_returns: [],
  },
];
