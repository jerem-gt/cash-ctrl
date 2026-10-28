export interface User {
  id: number;
  username: string;
  email: string | null;
  password_hash: string;
  is_admin: number;
  totp_secret: string | null;
  totp_enabled: number;
  created_at: string;
}

export interface ResetTokenRow {
  user_id: number;
  expires_at: number;
}
