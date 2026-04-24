export interface Bank {
  id: number;
  name: string;
  logo: string | null;
  created_at: string;
}

export interface BankWithCount extends Bank {
  acc_count: number;
}
