/**
 * AUTH — Kiểu dữ liệu tầng application (input/output contract).
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 * Không import HTTP, không import infrastructure.
 */

export interface RegisterInput { email: string; password: string; first_name: string; last_name: string; role?: 'admin' | 'analyst' }

export interface LoginInput { email: string; password: string; remember_me?: boolean }

/** Kết quả đăng nhập qua Google (AUTH-03) — cùng shape với `login` + `provider`. */
export interface GoogleLoginResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  device_name: string;
  remember_me: boolean;
  expires_at: string;
  user: { id: string; email: string; role: 'admin' | 'analyst' };
  provider: 'google';
}
