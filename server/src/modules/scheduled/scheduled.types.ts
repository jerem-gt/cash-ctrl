export interface ScheduledTransaction {
  id: number;
  user_id: number;
  account_id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category_id: number | null;
  category: string;
  payment_method_id: number | null;
  payment_method: string;
  notes: string | null;
  recurrence_unit: 'day' | 'week' | 'month' | 'year';
  recurrence_interval: number;
  recurrence_day: number | null;
  recurrence_month: number | null;
  to_account_id: number | null;
  weekend_handling: 'allow' | 'before' | 'after';
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
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category_id: number;
  payment_method_id: number;
  notes: string | null;
  recurrence_unit: 'day' | 'week' | 'month' | 'year';
  recurrence_interval: number;
  recurrence_day: number | null;
  recurrence_month: number | null;
  weekend_handling: 'allow' | 'before' | 'after';
  start_date: string;
  end_date: string | null;
  active: boolean;
}
