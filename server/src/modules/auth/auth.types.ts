export interface User {
  id: number;
  username: string;
  password_hash: string;
  is_admin: number;
  totp_secret: string | null;
  totp_enabled: number;
  created_at: string;
}
