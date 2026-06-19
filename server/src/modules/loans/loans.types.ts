export interface CreateLoanInput {
  name: string;
  bank_id: number | null;
  opening_date: string | null;
  principal_amount: number;
  interest_rate: number;
  duration_months: number;
  start_date: string;
  source_account_id: number;
  deposit_account_id: number;
}

export interface UpdateInstallmentInput {
  due_date: string;
  total_amount: number;
}

export interface UpdateLoanInput {
  name: string;
  bank_id: number | null;
  opening_date: string | null;
  source_account_id: number;
}
