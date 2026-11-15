/**
 * AUTH — Domain value objects: chính sách hạn token & trạng thái tài khoản.
 *
 * Lưu ý về "ghi nhớ đăng nhập" (remember me):
 * - Refresh token ở hệ thống này KHÔNG phải JWT — nó là chuỗi ngẫu nhiên lưu dạng
 *   hash trong `user_sessions.refresh_token_hash`.
 * - Vì vậy hạn thực tế của phiên nằm ở `user_sessions.expires_at` — đây là nguồn
 *   sự thật, không phải `exp` của JWT.
 * - Access token vẫn dùng hạn ngắn (`JWT_ACCESS_EXPIRATION`), độc lập remember-me.
 */

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Hạn phiên khi người dùng chọn "ghi nhớ đăng nhập" — 30 ngày. */
export const REMEMBER_ME_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const REFRESH_TOKEN_BYTES = 40;

export const DEFAULT_SALT_ROUNDS = 12;

/**
 * Tính thời điểm hết hạn của phiên.
 * @param rememberMe true → phiên 30 ngày, false → phiên 7 ngày.
 */
export function refreshTokenExpiry(from: Date = new Date(), rememberMe = false): Date {
  const ttl = rememberMe ? REMEMBER_ME_REFRESH_TOKEN_TTL_MS : REFRESH_TOKEN_TTL_MS;
  return new Date(from.getTime() + ttl);
}

export function isAccountLocked(status: string | null | undefined): boolean {
  return status === 'blocked';
}
