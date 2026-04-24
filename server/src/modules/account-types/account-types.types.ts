export interface AccountType {
  id: number;
  name: string;
  created_at: string;
}

export interface AccountTypeWithCount extends AccountType {
  acc_count: number;
}
