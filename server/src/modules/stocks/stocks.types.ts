export interface BuyInput {
  account_id: number;
  ticker: string;
  quantity: number;
  price_per_share: number;
  fees: number;
  date: string;
  description?: string;
}

export interface SellInput {
  account_id: number;
  ticker: string;
  quantity: number;
  price_per_share: number;
  fees: number;
  date: string;
  description?: string;
}

export interface TransferInput {
  from_account_id: number;
  to_account_id: number;
  ticker: string;
  quantity: number;
  date: string;
}
