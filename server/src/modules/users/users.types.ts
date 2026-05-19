export interface UserPublic {
  id: number;
  username: string;
  is_admin: number;
  created_at: string;
  account_count: number;
  tx_count: number;
  last_tx_date: string | null;
}
