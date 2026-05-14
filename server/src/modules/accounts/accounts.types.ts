export interface Account {
  id: number;
  user_id: number;
  name: string;
  bank_id: number | null;
  account_type_id: number | null;
  bank: string;
  type: string;
  envelope_type: string | null;
  initial_balance: number;
  opening_date: string | null;
  closed_at: string | null;
  balance: number;
  balance_all: number;
  balance_stocks: number;
  balance_insurance: number;
  capital_restant_du: number | null;
  capital_restant_du_all: number | null;
  created_at: string;
}

export interface CreateAccountInput {
  name: string;
  bank_id: number | null;
  account_type_id: number | null;
  initial_balance: number;
  opening_date: string | null;
}

export type UpdateAccountInput = CreateAccountInput;

export interface CloseAccountInput {
  closed_at: string;
  transfer_to_account_id?: number;
}
