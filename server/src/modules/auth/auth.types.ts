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

export interface TrustedDeviceRow {
  id: number;
  user_id: number;
  token_hash: string;
  label: string;
  created_at: number;
  last_used_at: number;
  expires_at: number;
}

export interface ResetTokenRow {
  user_id: number;
  expires_at: number;
}
