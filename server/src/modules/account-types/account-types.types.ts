export interface AccountType {
  id: number;
  name: string;
  envelope_type: string | null;
  created_at: string;
}

export interface AccountTypeWithCount extends AccountType {
  acc_count: number;
}
