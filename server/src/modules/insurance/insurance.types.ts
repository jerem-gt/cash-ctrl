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
  social_fees_transaction_id: number | null;
  type: InsuranceOperationType;
  amount: number;
  fees: number;
  social_fees: number;
  date: string;
  arbitrage_peer_id: number | null;
  created_at: string;
  from_scheduled: boolean;
}

export interface InsuranceSupportView {
  id: number;
  account_id: number;
  name: string;
  type: InsuranceSupportType;
  ticker: string | null;
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
  fees: number;
  date: string;
  source_account_id?: number | null;
}

export interface RachatInput {
  account_id: number;
  support_id: number;
  amount: number;
  fees: number;
  social_fees: number;
  date: string;
  dest_account_id?: number | null;
}

export interface ArbitrageInput {
  account_id: number;
  from_support_id: number;
  to_support_id: number;
  from_amount: number;
  fees: number;
  date: string;
}

export interface InteretsInput {
  account_id: number;
  support_id: number;
  amount: number;
  date: string;
}

export interface RevaloriserInput {
  account_id: number;
  support_id: number;
  amount: number;
  date: string;
}

export interface UpdateOperationInput {
  amount: number;
  fees: number;
  social_fees: number;
  date: string;
}
