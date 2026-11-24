/**
 * AUTH — Kiểu dữ liệu tầng application (input/output contract).
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 * Không import HTTP, không import infrastructure.
 */

/**
 * Đầu vào đăng ký tài khoản.
 *
 * OPEN-01 — **không có trường `role`**: mọi tài khoản tự đăng ký qua API công khai
 * đều là `analyst`. Tài khoản `admin` chỉ được tạo bởi **admin bootstrap** khi
 * khởi động ứng dụng (`ADMIN_EMAIL` + `ADMIN_PASSWORD`).
 */
export interface RegisterInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

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
