export interface BalanceHistoryPoint {
  date: string;
  balance: number;
}

export interface AccountBalanceHistoryResponse {
  account_id: number;
  days: number;
  points: BalanceHistoryPoint[];
}
