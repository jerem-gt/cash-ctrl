export interface UserSettings {
  lead_days: number;
  backup_enabled: number; // 0 | 1
  backup_frequency_h: number;
  backup_max_files: number;
  backup_last_at: string | null;
  backup_last_hash: string | null;
}
