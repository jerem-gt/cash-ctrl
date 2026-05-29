export interface UserSettings {
  lead_days: number;
  backup_enabled: number; // 0 | 1
  backup_frequency_h: number;
  backup_max_files: number;
  backup_last_at: string | null;
  backup_last_hash: string | null;
  financial_income_category_id: number | null;
  transfer_subcategory_id: number | null;
  transfer_payment_method_id: number | null;
  bank_fees_subcategory_id: number | null;
  social_fees_subcategory_id: number | null;
  prelevement_payment_method_id: number | null;
}
