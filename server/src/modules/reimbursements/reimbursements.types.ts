export interface Reimbursement {
  id: number;
  amount: number;
  description: string;
  date: string;
  subcategory: string;
  category: string;
  payment_method: string;
}

export interface PendingReimbursement {
  id: number;
  amount: number;
  description: string;
  date: string;
  subcategory: string;
  category: string;
  account_name: string;
  total_reimbursed: number;
}
