export interface Account {
  id: number;
  user_id: number;
  name: string;
  bank_id: number | null;
  account_type_id: number | null;
  bank: string;
  type: string;
  is_investment: number;
  initial_balance: number;
  opening_date: string | null;
  closed_at: string | null;
  balance: number;
  balance_stocks: number;
  capital_restant_du: number | null;
  created_at: string;
}

export interface CreateAccountInput {
  name: string;
  bank_id: number | null;
  account_type_id: number | null;
  initial_balance: number;
  opening_date: string;
}

export type UpdateAccountInput = CreateAccountInput;

export interface CloseAccountInput {
  closed_at: string;
  transfer_to_account_id?: number;
}
