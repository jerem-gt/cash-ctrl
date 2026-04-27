export interface ExportTxRow {
  date: string;
  type: string;
  description: string;
  category: string;
  subcategory: string;
  account: string;
  amount: number;
  payment_method: string;
  validated: number;
  notes: string | null;
}

export interface ExportAccount {
  id: number;
  name: string;
  bank: string;
  type: string;
  initial_balance: number;
  created_at: string;
}

export interface ExportTransaction {
  id: number;
  account_id: number;
  type: string;
  amount: number;
  description: string;
  category_id: string;
  subcategory_id: number | null;
  payment_method_id: number | null;
  category: string;
  subcategory: string;
  payment_method: string;
  date: string;
  validated: number;
  notes: string | null;
  transfer_peer_id: number | null;
  created_at: string;
}
