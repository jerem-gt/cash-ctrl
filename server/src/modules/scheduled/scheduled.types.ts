import { RecurrenceUnit, TransactionType, WeekendHandling } from '../../constants';

export interface ScheduledTransaction {
  id: number;
  user_id: number;
  account_id: number;
  type: TransactionType;
  amount: number;
  description: string;
  category_id: number | null;
  subcategory_id: number | null;
  category: string;
  subcategory: string;
  payment_method_id: number | null;
  payment_method: string;
  notes: string | null;
  recurrence_unit: RecurrenceUnit;
  recurrence_interval: number;
  recurrence_day: number | null;
  recurrence_month: number | null;
  to_account_id: number | null;
  insurance_support_id: number | null;
  insurance_fees: number;
  insurance_support_name: string;
  weekend_handling: WeekendHandling;
  start_date: string;
  end_date: string | null;
  active: number;
  last_generated_until: string | null;
  created_at: string;
  account_name?: string;
}

export interface CreateScheduledInput {
  account_id: number;
  to_account_id: number | null;
  type: TransactionType;
  amount: number;
  description: string;
  subcategory_id: number | null;
  payment_method_id: number | null;
  insurance_support_id: number | null;
  insurance_fees: number;
  notes: string | null;
  recurrence_unit: RecurrenceUnit;
  recurrence_interval: number;
  recurrence_day: number | null;
  recurrence_month: number | null;
  weekend_handling: WeekendHandling;
  start_date: string;
  end_date: string | null;
  active: boolean;
}
