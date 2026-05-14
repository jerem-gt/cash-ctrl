import { InsuranceOperationType, InsuranceSupportType } from '../../constants';

export interface InsuranceSupport {
  id: number;
  account_id: number;
  name: string;
  type: InsuranceSupportType;
  ticker: string | null;
  created_at: string;
}

export interface InsuranceOperation {
  id: number;
  account_id: number;
  support_id: number;
  support_name: string;
  support_type: InsuranceSupportType;
  transaction_id: number | null;
  fees_transaction_id: number | null;
  type: InsuranceOperationType;
  quantity: number | null;
  price_per_unit: number | null;
  amount: number;
  fees: number;
  date: string;
  arbitrage_peer_id: number | null;
  created_at: string;
}

export interface InsuranceSupportView {
  id: number;
  account_id: number;
  name: string;
  type: InsuranceSupportType;
  ticker: string | null;
  // UC only
  quantity: number | null;
  avg_price: number | null;
  current_price: number | null;
  current_price_currency: string;
  // Euro only
  balance: number | null;
  // Common
  value: number;
}

export interface CreateSupportInput {
  account_id: number;
  name: string;
  type: InsuranceSupportType;
  ticker?: string | null;
}

export interface VersementInput {
  account_id: number;
  support_id: number;
  amount: number;
  quantity: number | null;
  price_per_unit: number | null;
  fees: number;
  date: string;
}

export interface RachatInput {
  account_id: number;
  support_id: number;
  amount: number;
  quantity: number | null;
  price_per_unit: number | null;
  fees: number;
  date: string;
}

export interface ArbitrageInput {
  account_id: number;
  from_support_id: number;
  to_support_id: number;
  from_amount: number;
  from_quantity: number | null;
  from_price_per_unit: number | null;
  to_quantity: number | null;
  to_price_per_unit: number | null;
  fees: number;
  date: string;
}

export interface InteretsInput {
  account_id: number;
  support_id: number;
  amount: number;
  date: string;
}
