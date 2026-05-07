export interface NewAccountInput {
  qif_name: string;
  name: string;
  bank_id: number | null;
  account_type_id: number | null;
  initial_balance: number;
  opening_date: string;
}

export interface NewSubcategoryInput {
  qif_key: string;
  category_id?: number;
  new_category_name?: string;
  new_category_icon?: string;
  subcategory_name: string;
}

export interface ImportTransactionInput {
  account_id: number | null;
  new_account_qif_name: string | null;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  subcategory_id: number | null;
  new_subcategory_key: string | null;
  date: string;
  notes: string | null;
  validated: boolean;
}

export interface ImportTransferInput {
  from_account_id: number | null;
  from_account_qif_name: string | null;
  to_account_id: number | null;
  to_account_qif_name: string | null;
  amount: number;
  description: string;
  date: string;
  notes: string | null;
  validated: boolean;
}

export interface ImportExecuteBody {
  newAccounts: NewAccountInput[];
  newSubcategories: NewSubcategoryInput[];
  transactions: ImportTransactionInput[];
  transfers: ImportTransferInput[];
}

export interface ImportResult {
  transactions: number;
  transfers: number;
}
