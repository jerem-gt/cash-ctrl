import type {
  Account,
  AccountType,
  Bank,
  Category,
  PaginatedTransactions,
  PaymentMethod,
  PendingReimbursement,
  Reimbursement,
  ScheduledTransaction,
  StockOperation,
  StockPosition,
  Subcategory,
} from '@/types';

export const ACCOUNTS: Account[] = [
  {
    id: 1,
    name: 'Compte test',
    bank_id: 1,
    bank: 'BNP',
    account_type_id: 1,
    type: 'Courant',
    is_investment: 0,
    initial_balance: 0,
    opening_date: '2024-01-01',
    balance: 1500,
    balance_stocks: 0,
  },
  {
    id: 2,
    name: 'Livret A',
    bank: 'LCL',
    bank_id: 2,
    account_type_id: 1,
    type: 'Livret',
    is_investment: 0,
    initial_balance: 0,
    opening_date: null,
    balance: 500,
    balance_stocks: 0,
  },
];

export const ACCOUNT_TYPES: AccountType[] = [
  { id: 1, name: 'Courant', is_investment: 0, acc_count: 1 },
  { id: 3, name: 'Bourse', is_investment: 1, acc_count: 1 },
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
    ticker: 'DCAM.PA',
    type: 'buy',
    quantity: 10,
    price_per_share: 12,
    fees: 1.5,
    date: '2026-04-01',
    created_at: '2026-04-01T10:00:00',
  },
];

export const BANKS: Bank[] = [
  { id: 1, name: 'BNP', logo: 'image-qui-n-existe-pas.png', domain: 'bnp.fr' },
];

export const CATEGORIES: Category[] = [
  {
    id: 1,
    name: 'Alimentation',
    color: '#22c55e',
    icon: '🍴',
    subcategories: [{ id: 1, name: 'Supermarché' }],
  },
  {
    id: 2,
    name: 'Logement',
    color: '#5C6BC0',
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
  },
];

export const REIMBURSEMENTS: Reimbursement[] = [
  {
    id: 20,
    amount: 45,
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
