export interface Loan {
  id: number;
  account_id: number;
  user_id: number;
  principal_amount: number;
  interest_rate: number;
  duration_months: number;
  start_date: string;
  monthly_payment: number;
  source_account_id: number;
  deposit_account_id: number;
  deposit_transaction_id: number | null;
  created_at: string;
}

export interface LoanInstallment {
  id: number;
  loan_id: number;
  installment_number: number;
  due_date: string;
  total_amount: number;
  principal_amount: number;
  interest_amount: number;
  transaction_id: number | null;
  transaction_validated: number | null;
}

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
