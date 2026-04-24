export interface Account {
  id: number;
  user_id: number;
  name: string;
  bank_id: number | null;
  account_type_id: number | null;
  bank: string;
  type: string;
  initial_balance: number;
  created_at: string;
}

export interface CreateAccountInput {
  name: string;
  bank_id: number | null;
  account_type_id: number | null;
  initial_balance: number;
}

export type UpdateAccountInput = CreateAccountInput;
