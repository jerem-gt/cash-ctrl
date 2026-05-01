export interface StockPosition {
  id: number;
  account_id: number;
  ticker: string;
  quantity: number;
  avg_price: number;
  current_price: number | null;
  currency: string;
  price_fetched_at: string | null;
  updated_at: string;
  created_at: string;
}

export interface StockOperation {
  id: number;
  account_id: number;
  transaction_id: number;
  ticker: string;
  type: 'buy' | 'sell';
  quantity: number;
  price_per_share: number;
  fees: number;
  date: string;
  created_at: string;
}

export interface StockPrice {
  ticker: string;
  price: number;
  currency: string;
  fetched_at: string;
}

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
