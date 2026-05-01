export interface AccountType {
  id: number;
  name: string;
  is_investment: number;
  created_at: string;
}

export interface AccountTypeWithCount extends AccountType {
  acc_count: number;
}
