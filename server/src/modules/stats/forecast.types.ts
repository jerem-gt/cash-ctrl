export interface ForecastPoint {
  date: string;
  balance: number;
}

export interface ForecastAccount {
  account_id: number;
  account_name: string;
  bank_id: number;
  current_balance: number;
  points: ForecastPoint[];
  goes_negative_on: string | null;
}

export interface ForecastResponse {
  horizon: number;
  accounts: ForecastAccount[];
}
