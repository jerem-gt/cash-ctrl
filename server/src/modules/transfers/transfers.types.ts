export interface TransferInput {
  from_account_id: number;
  to_account_id: number;
  amount: number;
  description: string;
  date: string;
  notes?: string | null;
  validated?: boolean;
  scheduled_id?: number;
}

export interface UpdateTransferInput {
  amount: number;
  description: string;
  date: string;
  validated: boolean;
  from_account_id?: number;
  to_account_id?: number;
}
